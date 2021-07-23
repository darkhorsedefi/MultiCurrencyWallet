import { FormattedMessage } from 'react-intl'
import CSSModules from 'react-css-modules'
import styles from './index.scss'
import Notification from 'components/notification/Notification/Notification'

type ComponentProps = { data: { link: string }; name: string }

function Transaction(props: ComponentProps) {
  const { name, data } = props

  return (
    <Notification soundPlay={true} timeout={15_000} name={name}>
      <h3>
        <FormattedMessage
          id="transactonIsCompleted"
          defaultMessage="The transaction is completed"
        />
      </h3>
      <a href={data.link} target="_blank" styleName="transactionLink">
        <FormattedMessage id="viewTransaction" defaultMessage="View the transaction" />
      </a>
    </Notification>
  )
}

export default CSSModules(Transaction, styles, { allowMultiple: true })
