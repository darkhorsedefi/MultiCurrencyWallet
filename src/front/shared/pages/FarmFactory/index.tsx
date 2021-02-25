import React from 'react'
import cssModules from 'react-css-modules'
import styles from './index.scss'
import config from 'app-config'
import factoryStyles from './lib/farmfactory.css'
// import { farmDeployer } from './lib/farmdeployer'
import { farmFactory } from './lib/farmfactory'
import { constants, feedback, metamask, web3 } from 'helpers'
import { ethereumProxy } from 'helpers/web3'

const isDark = localStorage.getItem(constants.localStorage.isDark)

type FarmFactoryState = {
  internalAddress: string
  rewardsAddress: string
  stakingAddress: string
  duration: number
  decimal: number
  error: IError
}

@cssModules(styles, { allowMultiple: true })
export default class FarmFactory extends React.Component<null, FarmFactoryState> {
  constructor(props) {
    super(props)
    
    const internalAddress = web3.eth.accounts.wallet[0].address

    this.state = {
      internalAddress,
      rewardsAddress: internalAddress, // default in input
      stakingAddress: internalAddress, // default in input
      duration: 2000003, // ~ 9.25 hours
      decimal: 18,
      error: null,
    }
  }

  componentDidMount() {
    const { internalAddress } = this.state
    feedback.farmFactory.started()

    // hasn't plugin in the browser
    if (!metamask.isConnected()) {
      if (!window.web3) {
        window.web3 = web3
      }
      // if false it means that user has plugin,
      // but metamask isn't connected to our wallet
      if (!window.ethereum) {
        window.ethereum = ethereumProxy
      }
    }

    const { 
      farmAddress,
      rewardsAddress,
      stakingAddress,
    } = window

    // farmDeployer.init({
    //   rewardsAddress: '',
    //   stakingAddress: internalAddress,
    //   duration: 2000003,
    //   decimal: 18,
    //   // onStartLoading: () => null,
    //   // onFinishLoading: () => null,
    //   onError: (error) => this.reportError(error),
    // })

    farmFactory.init({
      networkName: config.entry === 'testnet' ? 'ropsten' : 'mainnet',
      farmAddress: farmAddress,
      rewardsAddress: rewardsAddress,
      stakingAddress: stakingAddress,
    })
  }

  componentDidCatch(error) {
    this.reportError(error)
  }

  reportError = (error) => {
    feedback.farmFactory.failed(`error name(${error.name}) : error message(${error.message})`)
    this.setState({  error })
    console.error(error)
  }

  render() {
    const { error } = this.state

    return (
      <section styleName={`farmFactory ${isDark ? "dark" : ""}`}>
        {/* own style for widget */}
        <div style={factoryStyles} id="farmfactory-widget-root"></div>

        {error && (
            <div styleName='farmFactoryErrorWrapper'>
              <h3>Error</h3>
              {error.code && <p>Code: {error.code}</p>}
              {error.name && <p>Name: {error.name}</p>}
              {error.message && <p>Message: {error.message}</p>}
            </div>
          )
        }
      </section>
    )
  }
}
