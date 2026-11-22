# Week 8 — Liquidity Vault

For Week 8, I worked on a simple liquidity vault using Anchor and Rust. I added the `initialize_vault` and `create_user_card` instructions. The program creates a vault PDA, a token account, a share mint, and a separate card for each user.

At first, I had some problems with Rust and Anchor installation. After fixing them, I successfully built and deployed the program to Solana Devnet.

I also ran the tests, and all 3 passed.

## What I learned

I learned how PDA accounts work in Anchor and how to create and store user data in a Solana program.

The vault doesn't support deposits or withdrawals yet. I will work on deposits and share tokens in Week 9.
