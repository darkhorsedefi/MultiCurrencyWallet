import React from 'react'
import PropTypes from 'prop-types'
import './Balances.scss'

import Ethereum from '../../instances/ethereum'

import Coin from './coin-1.svg'
import Withdraw from '../controls/Withdraw/Withdraw'

const Balances = ({createAccount}) => {
    function onCreate() {
        const account = Ethereum.login()
        createAccount(account)
    }
    return(
        <tbody>
            <tr>
                <td>
                    <div className="table__coins">
                        <span className="table__coin-left" className="coin-btc">
                            <img src={Coin} alt=""/>
                        </span>
                    </div>
                </td>
                <td>
                    <div className="table__name">Bitcoin</div>
                </td>
                <td>
                    <div className="table__balance">248.90037000</div>
                </td>
                <td>
                    <div className="table__key">0x5ee7c14f62786add137fe729a88e870e8187b92d</div>
                </td>
                <td>
                    <Withdraw text="Withdraw"/>
                    <Withdraw onClick={ onCreate } text="Create account" />
                </td>
            </tr>                        
        </tbody>
    )
}


Balances.propTypes = {

};

export default Balances

