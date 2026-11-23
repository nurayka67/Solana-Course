# Week 10 — Withdraw & CPI

For Week 10, I added the withdraw function to my liquidity vault using Anchor and Rust.

Users can now return their share tokens and withdraw SPL tokens from the vault. The program burns the shares and transfers tokens back to the user using CPI.

At first, I had a problem deploying the updated program because it needed more space. I extended the program account and deployed it successfully to Solana Devnet.

I ran the tests, and all 12 passed.

## What I learned

I learned how CPI works in Solana, how to burn share tokens, and how a vault PDA can sign token transfers.

I also tested withdrawals from different users and checked that invalid withdrawals were rejected.

## Week 11 — Raydium CLMM Pool (Devnet)

Created two SPL tokens and a Raydium CLMM pool on Solana Devnet.

### Tokens
- TOKEN_A: `ADaNt9CjREvjP9DeYs2JK4CNrw3FAeDFvJW1KHTyXd2Z`
- TOKEN_B: `3QFjgynxLMHPE5yihHrsAoPtG3ksKK5jHVoTRsmBA2cD`

### CLMM Pool
- Pool address: `EpWLXGcgoxACt3dVaFpSE7wBtEmJqegTdNDRhpLAraKF`
- Fee: 0.25%
- Tick spacing: 60
- Network: Devnet

[View Pool on Solana Explorer](https://explorer.solana.com/address/EpWLXGcgoxACt3dVaFpSE7wBtEmJqegTdNDRhpLAraKF?cluster=devnet)

### Run
```shell
yarn install
yarn create-pool
```

Script: `scripts/create-clmm-pool.ts`
