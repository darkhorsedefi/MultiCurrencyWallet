import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { constants } from 'helpers'
import actions from 'redux/actions'
import Link from 'sw-valuelink'

import cssModules from 'react-css-modules'
import styles from './WithdrawModal.scss'

import Modal from 'components/modal/Modal/Modal'
import FieldLabel from 'components/forms/FieldLabel/FieldLabel'
import Input from 'components/forms/Input/Input'
import Button from 'components/controls/Button/Button'
import Tooltip from 'components/ui/Tooltip/Tooltip'
import { FormattedMessage } from 'react-intl'
import ReactTooltip from 'react-tooltip'


const minAmount = {
  eth: 0.05,
  btc: 0.004,
  eos: 1,
  tlos: 1,
  noxon: 1,
  swap: 1,
  jot: 1,
}


@cssModules(styles)
export default class WithdrawModal extends React.Component {

  static propTypes = {
    name: PropTypes.string,
    data: PropTypes.object,
  }

  state = {
    isShipped: false,
    address: '',
    amount: '',
  }

  componentWillMount() {
    this.setBalanceOnState(this.props.data.currency)
  }

  setBalanceOnState = async (currency) => {
    const { data: { unconfirmedBalance } } = this.props

    const balance = await actions[currency.toLowerCase()].getBalance(currency.toLowerCase())

    const finalBalance = unconfirmedBalance !== undefined && unconfirmedBalance < 0
      ? Number(balance) + Number(unconfirmedBalance)
      : balance

    this.setState(() => ({ balance: finalBalance }))
  }

  handleSubmit = () => {
    const { address: to, amount } = this.state
    const { data: { currency, contractAddress, address, balance, decimals }, name } = this.props

    this.setState(() => ({ isShipped: true }))

    this.setBalanceOnState(currency)

    actions[currency.toLowerCase()].send(contractAddress || address, to, Number(amount), decimals)
      .then(() => {
        actions.loader.hide()
        actions[currency.toLowerCase()].getBalance(currency)
        this.setBalanceOnState(currency)

        actions.notifications.show(constants.notifications.SuccessWithdraw, {
          amount,
          currency,
          address: to,
        })

        this.setState(() => ({ isShipped: false }))
        actions.modals.close(name)
      })
  }

All = () => {
  const { amount, balance, showWarning } = this.state
  const { data } = this.props
  const balanceMiner = balance !== 0 ?
    Number(balance) - minAmount[data.currency.toLowerCase()]
    :
    balance
  this.setState({
    amount: balanceMiner,
  })
}

render() {
  const { address, amount, balance, isShipped, showWarning } = this.state
  const { name, data } = this.props

  const linked = Link.all(this, 'address', 'amount')
  const isDisabled =
    !address || !amount || isShipped || Number(amount) < minAmount[data.currency.toLowerCase()] || Number(amount) + minAmount[data.currency.toLowerCase()] > balance

  if (Number(amount) !== 0) {
    linked.amount.check((value) => Number(value) + minAmount[data.currency.toLowerCase()] <= balance,
      <div style={{ width: '350px', fontSize: '12px' }}>
        <FormattedMessage id="Withdrow108" defaultMessage="The amount must be less than your balance on the miners fee " />
        {minAmount[data.currency.toLowerCase()]}
      </div>
    )
    linked.amount.check((value) => Number(value) > minAmount[data.currency.toLowerCase()],
      <div style={{ width: '350px', fontSize: '12px' }}>
        <FormattedMessage id="Withdrow108" defaultMessage="Amount must be greater than  " />
        {minAmount[data.currency.toLowerCase()]}
      </div>
    )
  }

  if (this.state.amount < 0) {
    this.setState({
      amount: '',
    })
  }
  return (
    <Modal name={name} title={`Withdraw ${data.currency.toUpperCase()}`}>
      <p
        style={{ fontSize: '16px' }}
      >
        {`Please notice, that you need to have minimum ${minAmount[data.currency.toLowerCase()]} amount `}
        <br />
        of the {data.currency} on your wallet, to use it for miners fee
      </p>
      <FieldLabel inRow>
        <FormattedMessage id="Withdrow108" defaultMessage="Address " />
        <Tooltip text="destination address " />
      </FieldLabel>
      <Input valueLink={linked.address} focusOnInit pattern="0-9a-zA-Z" placeholder="Enter address" />
      <p style={{ marginTop: '20px' }}>
        <FormattedMessage id="Withdrow113" defaultMessage="Your balance: " />
        {Number(balance).toFixed(5)}
        {data.currency.toUpperCase()}
      </p>
      <FieldLabel inRow>
        <FormattedMessage id="Withdrow118" defaultMessage="Amount " />
      </FieldLabel>
      <div styleName="group">
        <Input styleName="input" valueLink={linked.amount} pattern="0-9\." placeholder={`Enter amount, you have ${Number(balance).toFixed(5)}`} />
        <buttton styleName="button" onClick={this.All} data-tip data-for="Withdrow134">
          <FormattedMessage id="Select24" defaultMessage="MAX" />
        </buttton>
        <ReactTooltip id="Withdrow134" type="light" effect="solid">
          <FormattedMessage
            id="WithdrawButton32"
            defaultMessage="when you click this button, in the field, an amount equal to your balance minus the miners commission will appear" />
        </ReactTooltip>
      </div>
      {
        !linked.amount.error && (
          <div styleName="note">
            <FormattedMessage id="WithdrawModal106" defaultMessage="No less than " />
            {minAmount[data.currency.toLowerCase()]}
          </div>
        )
      }
      <Button styleName="buttonFull" brand fullWidth disabled={isDisabled} onClick={this.handleSubmit}>
        <FormattedMessage id="WithdrawModal111" defaultMessage="Transfer " />
      </Button>
    </Modal>
  )
}
}
