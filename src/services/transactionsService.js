import axios from 'axios'
import Swal from 'sweetalert2'
import store from '../redux/store'
import { changeExpenses, changeStatus, getTransactions, handleTransferMoney } from '../slices/transactionsSlice'
import api from '../utils/api.json'
import { modifyAccount } from './accountsService'

export async function ReadTransactions() {
  store.dispatch(changeStatus({ success: false, error: false, loading: true }))
  const token = store?.getState()?.auth?.token
  const USER = store.getState().auth.user
  let auxExpense = 0, auxMoneyTransf = 0

  const res = await axios.get(`${api.url}${api.transactions}`,
    {
      headers: {
        Authorization: 'Bearer ' + token,
      }
    })
    .catch(err => {
      if (err.response.status === 401) {
        Swal.fire(
          'Oops!',
          'You are unauthorized',
          'error'
        );
      }
      if (err.response.status === 403) {
        Swal.fire(
          'Oops!',
          'Forbidden access',
          'error'
        );
      }
      store.dispatch(changeStatus({ success: false, error: true, loading: false }))
    })

  const storageExpenses = JSON.parse(localStorage.getItem('expenses'))
  storageExpenses?.data?.forEach(expense => {
    auxExpense += parseInt(expense.amount)
  })

  for (const d of res.data.data) {
    if (d.userId === USER.id && d.type === 'payment') {
      auxMoneyTransf += parseInt(d.amount)
    }
  }

  store.dispatch(changeExpenses({
    expenses: auxExpense,
    moneyTransferred: auxMoneyTransf,
    totalExpending: auxExpense + auxMoneyTransf
  }))
  await SearchSenderUser(res.data)
}

export function NavTransactions(pagePath) {
  store.dispatch(changeStatus({ success: false, error: false, loading: true }))

  axios.get(`${api.url}${pagePath}`,
    {
      headers: {
        Authorization: 'Bearer ' + store.getState().auth.token,
      }
    })
    .then(res => {
      SearchSenderUser(res.data)
    })
    .catch(err => {
      if (err.response.status === 401) {
        Swal.fire(
          'Oops!',
          'You are unauthorized',
          'error'
        );
      }
      if (err.response.status === 403) {
        Swal.fire(
          'Oops!',
          'Forbidden access',
          'error'
        );
      }
      store.dispatch(changeStatus({ success: false, error: true, loading: false }))
    })
}

async function SearchSenderUser({ nextPage, previousPage, data }) {
  let transactions = []

  for (const d of data) {
    const user = await axios.get(`${api.url}${api.users}/${d.userId}`).catch(err => {
      if (err.status === 401) {
        Swal.fire(
          'Oops!',
          'You are unauthorized',
          'error'
        );
      }
      if (err.status === 403) {
        Swal.fire(
          'Oops!',
          'Forbidden access',
          'error'
        );
      }
    })
    const { id, first_name, last_name, email, points, roleId } = user?.data

    transactions.push({ ...d, sender_user: { id, first_name, last_name, email, points, roleId } })
  }

  store.dispatch(getTransactions({ data: transactions, nextPage, previousPage }))
  store.dispatch(changeStatus({ success: true, error: false, loading: false }))
}

export const transferMoney = async ({ concept, CBU, amount, token }) => {
  store.dispatch(handleTransferMoney({ sendMoneySuccess: false, sendMoneyError: false, sendMoneyLoading: true }))
  const type = "payment"
  const currentAmount = store.getState()?.accounts?.userAccount[0]?.money ? store.getState()?.accounts?.userAccount[0]?.money : store.getState()?.accounts?.userAccount?.money

  // Se agrega el dinero a otra cuenta
  await axios.post(`http://wallet-main.eba-ccwdurgr.us-east-1.elasticbeanstalk.com/accounts/${CBU}`,
    { type: type, concept: concept, amount: amount },
    { headers: { Authorization: 'Bearer ' + token } }
  )


    .then(response => {
      store.dispatch(handleTransferMoney({ sendMoneySuccess: true, sendMoneyError: false, sendMoneyLoading: false }))
      if (response?.status === 200) {
        Swal.fire('', 'Deposit done!', 'success');
      }

      // Se modifica el dinero que está en la cuenta del usuario logueado
      modifyAccount({ toAccountId: CBU, amountToTransfer: parseInt(currentAmount) - parseInt(amount) })
    })


    .catch((e) => {
      store.dispatch(handleTransferMoney({ sendMoneySuccess: false, sendMoneyError: true, sendMoneyLoading: false }))
      if (e?.response?.status === 400) {
        Swal.fire('Oops!', 'Not enough cash :(', 'error');
      }
      if (e?.response?.status === 401) {
        Swal.fire(
          'Oops!',
          'You are unauthorized to do this transaction',
          'error'
        );
      }
      if (e?.response?.status === 403) {
        Swal.fire(
          'Oops!',
          'Source account or destination account blocked',
          'error'
        );
      }
      if (e?.response?.status === 404) {
        Swal.fire('Oops!', 'The account was not found', 'error');
      }
      if (e?.response?.status === 500) {
        Swal.fire(
          'Oops!',
          'Internal server error. Try again later!',
          'error'
        );
      }
    })
};