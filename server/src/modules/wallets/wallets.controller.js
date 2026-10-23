import { credentialInput, currencyInput, enumInput, money, nameInput, objectInput, positiveId } from '../../shared/validation/financialInput.js'
import exchangeAccountService from '../exchanges/exchangeAccount.service.js'
import { getExchangeAdapter, getSupportedExchanges } from '../exchanges/registry.js'

const WALLET_TYPES = new Set(['fiat', 'exchange'])
const EXCHANGE_SLUGS = getSupportedExchanges()

function compute_fiat_balance(wallet_repo, wallet, user_id) {
  const totals = wallet_repo.get_fiat_entry_totals_after_anchor({
    user_id,
    currency: wallet.currency,
    wallet_id: wallet.id,
    anchor_entry_id: wallet.balance_anchor_entry_id ?? 0,
  })
  return wallet.initial_balance + totals.total_income - totals.total_expense - totals.total_investment
}

export function makeWalletsController({ wallet_repo }) {
    function list(req, res) {
        const user_id = req.user.user_id
        const wallets = wallet_repo.list({ user_id })

        const result = wallets.map(wallet => {
            if (wallet.type === 'fiat') {
                return {
                    id: wallet.id,
                    name: wallet.name,
                    slug: null,
                    type: wallet.type,
                    currency: wallet.currency,
                    initial_balance: wallet.initial_balance,
                    balance: compute_fiat_balance(wallet_repo, wallet, user_id)
                }
            }
            // exchange wallets: balance fetched on demand via /live-balance
            const creds = wallet_repo.get_exchange_credentials({ wallet_id: wallet.id, user_id })
            return { 
                id: wallet.id,
                name: wallet.name,
                type: wallet.type,
                currency: wallet.currency,
                initial_balance: wallet.initial_balance,
                balance: null, 
                slug: creds?.slug ?? null, 
                has_credentials: !!creds 
            }
        })

        res.json(result)
    }


    function create(req, res) {
        const body = objectInput(req.body)
        const name = nameInput(body.name)
        const normalized_currency = currencyInput(body.currency)
        const type = enumInput(body.type, WALLET_TYPES, 'type')
        const parsed_initial_balance = Object.hasOwn(body, 'initial_balance') ? money(body.initial_balance, 'initial_balance') : 0

        try {
            const user_id = req.user.user_id
            const balance_anchor_entry_id = type === 'fiat' ? wallet_repo.get_max_entry_id({ user_id }) : 0
            const result = wallet_repo.create({
                user_id,
                name,
                currency: normalized_currency,
                type,
                initial_balance: parsed_initial_balance,
                balance_anchor_entry_id,
            })
            const wallet = wallet_repo.find_by_id({ wallet_id: result.lastInsertRowid, user_id })
            res.status(201).json(wallet)
        } catch (e) {
            if (e.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'A wallet with this name already exists.' })
            }
            return res.status(500).json({ error: 'Internal server error' })
        }
    }

    function update(req, res) {
        const user_id = req.user.user_id
        const wallet_id = positiveId(req.params.id)
        const wallet = wallet_repo.find_by_id({ wallet_id, user_id })
        if (!wallet) return res.status(404).json({ error: 'Not found' })

        const body = objectInput(req.body)
        const name = Object.hasOwn(body, 'name') ? nameInput(body.name) : undefined
        const has_initial_balance = Object.hasOwn(body, 'initial_balance')
        const parsed_initial_balance = has_initial_balance ? money(body.initial_balance, 'initial_balance') : undefined

        const reset_anchor = has_initial_balance && wallet.type === 'fiat'
        wallet_repo.update({
            wallet_id: wallet.id,
            user_id,
            name,
            initial_balance: parsed_initial_balance,
            balance_anchor_entry_id: reset_anchor ? wallet_repo.get_max_entry_id({ user_id }) : undefined,
            reset_anchor,
        })
        res.json(wallet_repo.find_by_id({ wallet_id: wallet.id, user_id }))
    }

    function remove(req, res) {
        const user_id = req.user.user_id
        const wallet_id = positiveId(req.params.id)
        const wallet = wallet_repo.find_by_id({ wallet_id, user_id })
        if (!wallet) return res.status(404).json({ error: 'Not found' })

        wallet_repo.delete_by_id({ wallet_id: wallet.id, user_id })
        res.status(204).end()
    }

    function putExchangeCredentials(req, res) {
        const user_id = req.user.user_id
        const wallet_id = positiveId(req.params.id)
        const wallet = wallet_repo.find_by_id({ wallet_id, user_id })
        if (!wallet) return res.status(404).json({ error: 'Not found' })
        if (wallet.type !== 'exchange') return res.status(400).json({ error: 'Only exchange wallets support credentials' })

        const body = objectInput(req.body)
        const slug = enumInput(body.slug, EXCHANGE_SLUGS, 'exchange slug')
        const credentials = credentialInput(body.credentials, getExchangeAdapter(slug).credential_fields)

        wallet_repo.upsert_exchange_credentials({ user_id, wallet_id: wallet.id, slug, credentials })
        res.status(201).json({ ok: true })
    }

    async function getExchangeLiveBalance(req, res) {
        const user_id = req.user.user_id
        const wallet_id = positiveId(req.params.id)
        const wallet = wallet_repo.find_by_id({ wallet_id, user_id })
        if (!wallet) return res.status(404).json({ error: 'Not found' })
        if (wallet.type !== 'exchange') return res.status(400).json({ error: 'Only exchange wallets have a live balance' })

        const credentials_row = wallet_repo.get_exchange_credentials({ wallet_id: wallet.id, user_id })
        if (!credentials_row) return res.status(400).json({ error: 'No API credentials saved for this wallet' })

        try {
            const result = await exchangeAccountService.get_live_balance({ credentials_row })
            res.json(result)
        } catch (e) {
            res.status(e.status || 502).json({ error: e.message || 'Failed to fetch exchange balance' })
        }

    }

    return { list, create, update, remove, putExchangeCredentials, getExchangeLiveBalance}
}
