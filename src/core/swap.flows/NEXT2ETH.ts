import debug from 'debug'
import SwapApp, { constants, util } from 'swap.app'
import { AtomicAB2UTXO } from 'swap.swap'
import { BigNumber } from 'bignumber.js'


class NEXT2ETH extends AtomicAB2UTXO {

  _flowName: string
  ethSwap: any
  nextSwap: any
  state: any

  static getName() {
    return `${this.getFromName()}2${this.getToName()}`
  }
  static getFromName() {
    return constants.COINS.next
  }
  static getToName() {
    return constants.COINS.eth
  }

  constructor(swap) {
    super(swap)
    this.utxoCoin = `next`

    this._flowName = NEXT2ETH.getName()

    this.stepNumbers = {
      'sign': 1,
      'submit-secret': 2,
      'sync-balance': 3,
      'lock-next': 4,
      'wait-lock-eth': 5,
      'withdraw-eth': 6,
      'finish': 7,
      'end': 8
    }

    this.ethSwap = swap.ownerSwap
    this.nextSwap = swap.participantSwap

    this.abBlockchain = this.ethSwap
    this.utxoBlockchain = this.nextSwap
    this.isUTXOSide = true

    if (!this.ethSwap) {
      throw new Error('NEXT2ETH: "ethSwap" of type object required')
    }
    if (!this.nextSwap) {
      throw new Error('NEXT2ETH: "nextSwap" of type object required')
    }

    this.state = {
      step: 0,

      isStoppedSwap: false,

      signTransactionHash: null,
      isSignFetching: false,
      isParticipantSigned: false,

      ethSwapCreationTransactionHash: null,

      secretHash: null,

      isBalanceFetching: false,
      isBalanceEnough: true,
      balance: null,

      isEthContractFunded: false,

      nextSwapWithdrawTransactionHash: null,
      ethSwapWithdrawTransactionHash: null,

      canCreateEthTransaction: true,
      isEthWithdrawn: false,

      refundTransactionHash: null,
      isRefunded: false,

      withdrawFee: null,
      refundTxHex: null,
      isFinished: false,
      isSwapExist: false,

      requireWithdrawFee: false,
    }

    this._persistState()
    super._persistSteps()
  }

  _persistState() {
    super._persistState()
  }

  _getSteps() {
    const flow = this

    return [

      // 1. Signs

      async () => {
        this.signUTXOSide()
      },

      // 2. Create secret, secret hash and NEXT script

      () => {
        // this.submitSecret()
      },

      // 3. Check balance

      () => {
        this.syncBalance()
      },

      // 4. Create NEXT Script, fund, notify participant

      async () => {
        const onTransactionHash = (txID) => {
          const { utxoScriptCreatingTransactionHash, utxoScriptValues } = flow.state

          if (utxoScriptCreatingTransactionHash) {
            return
          }

          flow.setState({
            utxoScriptCreatingTransactionHash: txID,
          })

          flow.swap.room.once('request utxo script', () => {
            flow.swap.room.sendMessage({
              event:  'create utxo script',
              data: {
                scriptValues: utxoScriptValues,
                utxoScriptCreatingTransactionHash: txID,
              }
            })
          })

          flow.swap.room.sendMessage({
            event: 'create utxo script',
            data: {
              scriptValues : utxoScriptValues,
              utxoScriptCreatingTransactionHash : txID,
            }
          })
        }

        const { sellAmount } = flow.swap
        const { isBalanceEnough, utxoScriptValues } = flow.state

        if (isBalanceEnough) {
          await flow.nextSwap.fundScript({
            scriptValues: utxoScriptValues,
            amount: sellAmount,
          })
        }

        const checkNEXTScriptBalance = async () => {
          const { scriptAddress } = this.nextSwap.createScript(utxoScriptValues)
          const unspents = await this.nextSwap.fetchUnspents(scriptAddress)

          if (unspents.length === 0) {
            return false
          }

          const txID = unspents[0].txid

          const balance = await this.nextSwap.getBalance(utxoScriptValues)

          const isEnoughMoney = new BigNumber(balance).isGreaterThanOrEqualTo(sellAmount.times(1e8))

          if (isEnoughMoney) {
            flow.setState({
              scriptBalance: new BigNumber(balance).div(1e8).dp(8),
            })

            onTransactionHash(txID)
          }

          return isEnoughMoney
        }

        await util.helpers.repeatAsyncUntilResult(async (stopRepeat) => {
          const { isStoppedSwap } = flow.state

          if (!isStoppedSwap) {
            return await checkNEXTScriptBalance()
          } else {
            stopRepeat()
          }
        })

        const { isStoppedSwap } = flow.state

        if (!isStoppedSwap) {
          flow.finishStep({
            isNextScriptFunded: true,
          }, { step: 'lock-next' })
        }
      },

      // 5. Wait participant creates ETH Contract

      async () => {
        await flow.ethSwap.waitAB2UTXOContract({
          flow,
          utxoCoin: `next`,
        })
      },

      // 6. Withdraw

      async () => {
        await flow.ethSwap.withdrawFromAB2UTXO({ flow })
      },

      // 7. Finish

      () => {
        flow.swap.room.once('swap finished', ({nextSwapWithdrawTransactionHash}) => {
          flow.setState({
            nextSwapWithdrawTransactionHash,
          })
        })

        flow.swap.room.sendMessage({
          event: 'request swap finished',
        })

        flow.finishStep({
          isFinished: true,
        }, 'finish')
      },

      // 8. Finished!

      () => {}
    ]
  }

  async skipSyncBalance() {
    this.finishStep({}, { step: 'sync-balance' })
  }

  getRefundTxHex = () => {
    this.nextSwap.getRefundHexTransaction({
      scriptValues: this.state.utxoScriptValues,
      secret: this.state.secret,
    })
      .then((txHex) => {
        this.setState({
          refundTxHex: txHex,
        })
      })
  }

  tryRefund() {
    const flow = this
    const { utxoScriptValues, secret } = flow.state

    return flow.nextSwap.refund({
      scriptValues: utxoScriptValues,
      secret: secret,
    })
      .then((hash) => {
        if (!hash) {
          return false
        }

        this.swap.room.sendMessage({
          event: 'utxo refund completed',
        })

        flow.setState({
          refundTransactionHash: hash,
          isRefunded: true,
          isSwapExist: false,
        }, true)

        return true
      })
      .catch((error) => {
        if (/Address is empty/.test(error)) {
          // TODO - fetch TX list to script for refund TX
          flow.setState({
            isRefunded: true,
            isSwapExist: false,
          }, true)
          return true
        } else {
          console.warn('Next refund:', error)

          return false
        }
      })
  }

  async isRefundSuccess() {
    const { refundTransactionHash, isRefunded } = this.state
    if (refundTransactionHash && isRefunded) {
      if (await this.nextSwap.checkTX(refundTransactionHash)) {
        return true
      } else {
        console.warn('NEXT2ETH - unknown refund transaction')
        this.setState( {
          refundTransactionHash: null,
          isRefunded: false,
        } )
        return false
      }
    }
    return false
  }

  async tryWithdraw(_secret) {
    const { secret, secretHash, isEthWithdrawn } = this.state

    if (!_secret)
      throw new Error(`Withdrawal is automatic. For manual withdrawal, provide a secret`)

    if (secret && secret != _secret)
      console.warn(`Secret already known and is different. Are you sure?`)

    if (isEthWithdrawn)
      console.warn(`Looks like money were already withdrawn, are you sure?`)

    debug('swap.core:flow')(`WITHDRAW using secret = ${_secret}`)

    const _secretHash = this.app.env.bitcoin.crypto.ripemd160(Buffer.from(_secret, 'hex')).toString('hex')

    if (secretHash != _secretHash)
      console.warn(`Hash does not match! state: ${secretHash}, given: ${_secretHash}`)

    const { participant } = this.swap

    const flow = this

    const data = {
      ownerAddress: this.app.getParticipantEthAddress(flow.swap),
      secret: _secret,
    }

    await this.ethSwap.withdraw(data, (hash) => {
      debug('swap.core:flow')(`TX hash=${hash}`)
      this.setState({
        ethSwapWithdrawTransactionHash: hash,
        canCreateEthTransaction: true,
      })
    }).then(() => {

      this.finishStep({
        isEthWithdrawn: true,
      }, 'withdraw-eth')
    })
  }
}

export default NEXT2ETH
