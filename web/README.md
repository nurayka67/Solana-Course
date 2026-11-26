# Liquidity Vault — Week 14

Solana Devnet dApp built with React, TypeScript, Vite and Phantom.

## Features
- Connect Phantom wallet
- Display SOL, Token A and Token B balances
- Initialize Vault
- Create UserCard automatically
- Deposit Token A and mint share tokens
- Withdraw shares to redeem Token A
- Display Vault and share balances
- Admin: connect Token B to Vault
- Transaction links to Solana Explorer

## Run locally

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173

Use Phantom with Solana Devnet selected.

## Devnet addresses

Program:
8ENLb6EtpgGwGmbn2TVecPPVPNhbRdZo9LCF7vDTs8kN

Token A:
ADaNt9CjREvjP9DeYs2JK4CNrw3FAeDFvJW1KHTyXd2Z

Token B:
3QFjgynxLMHPE5yihHrsAoPtG3ksKK5jHVoTRsmBA2cD

Raydium CLMM pool:
EpWLXGcgoxACt3dVaFpSE7wBtEmJqegTdNDRhpLAraKF

## Architecture

Frontend: React + Vite + TypeScript
Wallet: Phantom
Blockchain: Solana Devnet
Program: Anchor / Rust
Token standard: SPL Token
Liquidity protocol: Raydium CLMM

Vault PDA: ["vault", token_mint]
Vault token PDA: ["vault_tokens", token_mint]
Share mint PDA: ["share_mint", token_mint]
UserCard PDA: ["user_card", vault_state, user]
Token B vault PDA: ["vault_tokens_b", token_mint]

## Verified transactions

- Vault initialization: successful
- Deposit 10 Token A: successful
- Withdraw 5 shares: successful
- Add Token B: successful

## Current limitations

Raydium Swap, Open Position, Collect Fees and Close Position
are implemented in the Anchor program from earlier weeks,
but are not yet exposed as working actions in the web UI.

The existing Devnet Raydium pool currently has no liquidity.

The npm dependency audit reports unresolved advisories.
This project is for educational Devnet use only.
Do not use real funds or production wallets.

## Team contribution

Student project: Solana Course, Week 14.
Frontend integration, Devnet testing and project documentation.
