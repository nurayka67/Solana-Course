# Week 10 — Withdraw & CPI

For Week 10, I added the withdraw function to my liquidity vault using Anchor and Rust.

Users can now return their share tokens and withdraw SPL tokens from the vault. The program burns the shares and transfers tokens back to the user using CPI.

At first, I had a problem deploying the updated program because it needed more space. I extended the program account and deployed it successfully to Solana Devnet.

I ran the tests, and all 12 passed.

## What I learned

I learned how CPI works in Solana, how to burn share tokens, and how a vault PDA can sign token transfers.

I also tested withdrawals from different users and checked that invalid withdrawals were rejected.
