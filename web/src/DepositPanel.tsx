import { useEffect, useState } from 'react';
import { Buffer } from 'buffer';
import {
  Connection, PublicKey, SystemProgram,
  Transaction, TransactionInstruction
} from '@solana/web3.js';
import idl from './idl/simple_vault.json';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const programId = new PublicKey(idl.address);
const mint = new PublicKey('ADaNt9CjREvjP9DeYs2JK4CNrw3FAeDFvJW1KHTyXd2Z');
const tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ataProgram = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

const [vault] = PublicKey.findProgramAddressSync(
  [Buffer.from('vault'), mint.toBuffer()], programId
);
const [vaultTokens] = PublicKey.findProgramAddressSync(
  [Buffer.from('vault_tokens'), mint.toBuffer()], programId
);
const [shareMint] = PublicKey.findProgramAddressSync(
  [Buffer.from('share_mint'), mint.toBuffer()], programId
);

type Phantom = {
  connect: () => Promise<{ publicKey: PublicKey }>;
  signAndSendTransaction: (tx: Transaction) => Promise<{ signature: string }>;
};

function getPhantom(): Phantom | undefined {
  return (window as Window & {
    phantom?: { solana?: Phantom }
  }).phantom?.solana;
}

function associatedAccount(owner: PublicKey, tokenMint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgram.toBuffer(), tokenMint.toBuffer()],
    ataProgram
  )[0];
}

function instructionData(name: string, amount?: bigint) {
  const ix = idl.instructions.find(i => i.name === name);
  if (!ix || ix.discriminator.length !== 8) {
    throw new Error(`Instruction ${name} not found in IDL`);
  }

  const discriminator = Buffer.from(ix.discriminator);
  if (amount === undefined) return discriminator;

  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, amount, true);
  return Buffer.concat([discriminator, Buffer.from(bytes)]);
}

type Props = {
  wallet: string;
  onSuccess: () => void | Promise<void>;
};

export default function DepositPanel({ wallet, onSuccess }: Props) {
  const [shares, setShares] = useState('0');
  const [vaultBalance, setVaultBalance] = useState('0');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [signature, setSignature] = useState('');

  async function refresh() {
    const owner = new PublicKey(wallet);
    const shareAccount = associatedAccount(owner, shareMint);
    const [shareInfo, vaultInfo] = await Promise.all([
      connection.getAccountInfo(shareAccount),
      connection.getTokenAccountBalance(vaultTokens),
    ]);

    setVaultBalance(vaultInfo.value.uiAmountString ?? '0');

    if (shareInfo) {
      const balance = await connection.getTokenAccountBalance(shareAccount);
      setShares(balance.value.uiAmountString ?? '0');
    } else {
      setShares('0');
    }
  }

  useEffect(() => {
    void refresh().catch(() => setStatus('Could not load Vault balances.'));
  }, [wallet]);

  async function deposit() {
    const phantom = getPhantom();
    if (!phantom) {
      setStatus('Phantom not found.');
      return;
    }

    try {
      setBusy(true);
      setSignature('');
      setStatus('Preparing deposit of 10 Token A...');

      const { publicKey: user } = await phantom.connect();
      if (user.toBase58() !== wallet) {
        throw new Error('Wallet changed. Reconnect on the dashboard.');
      }

      const userTokens = associatedAccount(user, mint);
      const userShares = associatedAccount(user, shareMint);
      const [userCard] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_card'), vault.toBuffer(), user.toBuffer()],
        programId
      );

      const [cardInfo, shareInfo, tokenBalance, vaultInfo] = await Promise.all([
        connection.getAccountInfo(userCard),
        connection.getAccountInfo(userShares),
        connection.getTokenAccountBalance(userTokens),
        connection.getAccountInfo(vault),
      ]);

      if (!vaultInfo) throw new Error('Vault is not initialized.');

      const amount = 10_000_000n;

      if (BigInt(tokenBalance.value.amount) < amount) {
        throw new Error('Not enough Token A for deposit.');
      }

      const tx = new Transaction();

      // Create the UserCard if it does not exist.
      if (!cardInfo) {
        tx.add(new TransactionInstruction({
          programId,
          keys: [
            { pubkey: vault, isSigner: false, isWritable: false },
            { pubkey: userCard, isSigner: false, isWritable: true },
            { pubkey: user, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: instructionData('create_user_card'),
        }));
      }

      // Create the share-token account if it does not exist.
      if (!shareInfo) {
        tx.add(new TransactionInstruction({
          programId: ataProgram,
          keys: [
            { pubkey: user, isSigner: true, isWritable: true },
            { pubkey: userShares, isSigner: false, isWritable: true },
            { pubkey: user, isSigner: false, isWritable: false },
            { pubkey: shareMint, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: tokenProgram, isSigner: false, isWritable: false },
          ],
          data: Buffer.from([1]),
        }));
      }

      // Send 10 Token A to the Vault and mint shares.
      tx.add(new TransactionInstruction({
        programId,
        keys: [
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: userCard, isSigner: false, isWritable: true },
          { pubkey: vaultTokens, isSigner: false, isWritable: true },
          { pubkey: shareMint, isSigner: false, isWritable: true },
          { pubkey: userTokens, isSigner: false, isWritable: true },
          { pubkey: userShares, isSigner: false, isWritable: true },
          { pubkey: user, isSigner: true, isWritable: true },
          { pubkey: tokenProgram, isSigner: false, isWritable: false },
        ],
        data: instructionData('deposit', amount),
      }));

      const latest = await connection.getLatestBlockhash('confirmed');
      tx.feePayer = user;
      tx.recentBlockhash = latest.blockhash;

      setStatus('Confirm Deposit 10 Token A in Phantom.');
      const result = await phantom.signAndSendTransaction(tx);
      setSignature(result.signature);

      setStatus('Waiting for Devnet confirmation...');
      const confirmed = await connection.confirmTransaction({
        signature: result.signature,
        ...latest,
      }, 'confirmed');

      if (confirmed.value.err) {
        throw new Error('Deposit transaction failed.');
      }

      await refresh();
      await onSuccess();
      setStatus('Deposit successful! 10 Token A deposited.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Deposit failed.');
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    const phantom = getPhantom();

    if (!phantom) {
      setStatus('Phantom not found.');
      return;
    }

    try {
      setBusy(true);
      setSignature('');
      setStatus('Preparing withdrawal of 5 shares...');

      const { publicKey: user } = await phantom.connect();

      if (user.toBase58() !== wallet) {
        throw new Error('Wallet changed. Reconnect first.');
      }

      const userTokens = associatedAccount(user, mint);
      const userShares = associatedAccount(user, shareMint);

      const [userCard] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_card'), vault.toBuffer(), user.toBuffer()],
        programId
      );

      const [cardInfo, shareBalance] = await Promise.all([
        connection.getAccountInfo(userCard),
        connection.getTokenAccountBalance(userShares),
      ]);

      if (!cardInfo) {
        throw new Error('UserCard not found.');
      }

      const amount = 5_000_000n;

      if (BigInt(shareBalance.value.amount) < amount) {
        throw new Error('Not enough shares.');
      }

      const transaction = new Transaction().add(
        new TransactionInstruction({
          programId,
          keys: [
            { pubkey: vault, isSigner: false, isWritable: true },
            { pubkey: userCard, isSigner: false, isWritable: true },
            { pubkey: vaultTokens, isSigner: false, isWritable: true },
            { pubkey: shareMint, isSigner: false, isWritable: true },
            { pubkey: userTokens, isSigner: false, isWritable: true },
            { pubkey: userShares, isSigner: false, isWritable: true },
            { pubkey: user, isSigner: true, isWritable: true },
            { pubkey: tokenProgram, isSigner: false, isWritable: false },
          ],
          data: instructionData('withdraw', amount),
        })
      );

      const latest = await connection.getLatestBlockhash('confirmed');
      transaction.feePayer = user;
      transaction.recentBlockhash = latest.blockhash;

      setStatus('Confirm withdrawal of 5 shares in Phantom.');

      const result = await phantom.signAndSendTransaction(transaction);
      setSignature(result.signature);

      setStatus('Waiting for Devnet confirmation...');

      const confirmed = await connection.confirmTransaction({
        signature: result.signature,
        ...latest,
      }, 'confirmed');

      if (confirmed.value.err) {
        throw new Error('Withdraw transaction failed.');
      }

      await refresh();
      await onSuccess();
      setStatus('Withdraw successful! 5 shares redeemed.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Withdraw failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 30 }}>
      <hr />
      <h2>Deposit & Withdraw</h2>
      <p>Vault Token A: {vaultBalance}</p>
      <p>My Share Tokens: {shares}</p>
      <p>First deposit: 10 Token A → 10 shares</p>

      <button onClick={deposit} disabled={busy}>
        Deposit 10 Token A
      </button>

      <button onClick={withdraw} disabled={busy}>Withdraw 5 Shares</button>
      <p>{status}</p>
      {signature && (
        <a
          href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
          target="_blank"
          rel="noreferrer"
        >
          View Transaction on Solana Explorer
        </a>
      )}
    </section>
  );
}



