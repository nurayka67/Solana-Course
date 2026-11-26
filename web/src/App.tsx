import { useState } from 'react';
import DepositPanel from './DepositPanel';
import {
  Connection, LAMPORTS_PER_SOL, PublicKey,
  Transaction, TransactionInstruction,
  SystemProgram, SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';

import { Buffer } from 'buffer';
import idl from './idl/simple_vault.json';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const programId = new PublicKey(idl.address);
const TOKEN_A = new PublicKey('ADaNt9CjREvjP9DeYs2JK4CNrw3FAeDFvJW1KHTyXd2Z');
const TOKEN_B = new PublicKey('3QFjgynxLMHPE5yihHrsAoPtG3ksKK5jHVoTRsmBA2cD');

const [vaultState] = PublicKey.findProgramAddressSync(
  [Buffer.from('vault'), TOKEN_A.toBuffer()], programId
);
const [vaultTokens] = PublicKey.findProgramAddressSync(
  [Buffer.from('vault_tokens'), TOKEN_A.toBuffer()], programId
);
const [shareMint] = PublicKey.findProgramAddressSync(
  [Buffer.from('share_mint'), TOKEN_A.toBuffer()], programId
);

type Phantom = {
  connect: () => Promise<{ publicKey: PublicKey }>;
  signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
};

function getPhantom(): Phantom | undefined {
  return (window as Window & { phantom?: { solana?: Phantom } }).phantom?.solana;
}

async function getTokenBalance(owner: PublicKey, mint: PublicKey) {
  const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });
  return accounts.value.reduce(
    (sum, item) =>
      sum + Number(item.account.data.parsed.info.tokenAmount.uiAmountString ?? 0),
    0
  );
}

export default function App() {
  const [wallet, setWallet] = useState('');
  const [sol, setSol] = useState('—');
  const [tokenA, setTokenA] = useState('—');
  const [tokenB, setTokenB] = useState('—');
  const [vaultReady, setVaultReady] = useState<boolean | null>(null);
  const [status, setStatus] = useState('Connect Phantom to get started.');
  const [busy, setBusy] = useState(false);
  const [signature, setSignature] = useState('');

  async function connectPhantom() {
    const phantom = getPhantom();
    if (!phantom) {
      setStatus('Phantom extension not found.');
      return;
    }

    try {
      setBusy(true);
      setStatus('Connecting...');
      const { publicKey } = await phantom.connect();

      const [lamports, a, b, vault] = await Promise.all([
        connection.getBalance(publicKey),
        getTokenBalance(publicKey, TOKEN_A),
        getTokenBalance(publicKey, TOKEN_B),
        connection.getAccountInfo(vaultState),
      ]);

      setWallet(publicKey.toBase58());
      setSol((lamports / LAMPORTS_PER_SOL).toFixed(4));
      setTokenA(a.toLocaleString());
      setTokenB(b.toLocaleString());
      setVaultReady(vault !== null);
      setStatus('Connected to Solana Devnet!');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Connection failed.');
    } finally {
      setBusy(false);
    }
  }

  async function initializeVault() {
    const phantom = getPhantom();
    if (!phantom || !wallet) return;

    try {
      setBusy(true);
      setSignature('');
      setStatus('Preparing Vault initialization...');

      const { publicKey: admin } = await phantom.connect();

      if (admin.toBase58() !== wallet) {
        throw new Error('Phantom wallet changed. Reconnect before continuing.');
      }

      const [existingVault, mintInfo] = await Promise.all([
        connection.getAccountInfo(vaultState),
        connection.getAccountInfo(TOKEN_A),
      ]);

      if (existingVault) {
        setVaultReady(true);
        setStatus('Vault already exists.');
        return;
      }

      if (!mintInfo || !mintInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        throw new Error('Token A mint is missing or is not a standard SPL token.');
      }

      const initInstruction = idl.instructions.find(
        item => item.name === 'initialize_vault'
      );

      if (!initInstruction || initInstruction.discriminator.length !== 8) {
        throw new Error('Initialize Vault instruction missing from IDL.');
      }

      const instruction = new TransactionInstruction({
        programId,
        keys: [
          { pubkey: vaultState, isSigner: false, isWritable: true },
          { pubkey: vaultTokens, isSigner: false, isWritable: true },
          { pubkey: shareMint, isSigner: false, isWritable: true },
          { pubkey: TOKEN_A, isSigner: false, isWritable: false },
          { pubkey: admin, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(initInstruction.discriminator),
      });

      const latest = await connection.getLatestBlockhash('confirmed');
      const transaction = new Transaction({
        feePayer: admin,
        recentBlockhash: latest.blockhash,
      }).add(instruction);

      setStatus('Confirm initialization in Phantom (Devnet only).');
      const result = await phantom.signAndSendTransaction(transaction);
      setSignature(result.signature);
      setStatus('Transaction sent. Waiting for confirmation...');

      const confirmation = await connection.confirmTransaction({
        signature: result.signature,
        ...latest,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction failed on Solana Devnet.');
      }

      setVaultReady(true);
      setStatus('Vault initialized successfully!');
      const lamports = await connection.getBalance(admin);
      setSol((lamports / LAMPORTS_PER_SOL).toFixed(4));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Initialization failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: 'auto', padding: 40 }}>
      <p style={{ color: '#a78bfa' }}>SOLANA DEVNET</p>
      <h1>Liquidity Vault</h1>
      <p>Manage your assets in a decentralized vault.</p>

      <button onClick={connectPhantom} disabled={busy}>
        Connect Phantom
      </button>
      <p>{status}</p>

      {wallet && (
        <section style={{ marginTop: 32, textAlign: 'left' }}>
          <h2>My Dashboard</h2>
          <p style={{ overflowWrap: 'anywhere' }}>Wallet: {wallet}</p>
          <h3>SOL Balance: {sol}</h3>
          <h3>Token A Balance: {tokenA}</h3>
          <h3>Token B Balance: {tokenB}</h3>

          <hr />
          <h2>Vault Status</h2>
          <p style={{ overflowWrap: 'anywhere' }}>
            Vault: {vaultState.toBase58()}
          </p>
          <p>
            {vaultReady === true
              ? 'Initialized'
              : vaultReady === false
                ? 'Not initialized'
                : 'Checking...'}
          </p>

          {vaultReady === false && (
            <>
              <p>
                The connected Phantom wallet will become the Vault admin
                and pay Devnet SOL for account creation.
              </p>
              <button onClick={initializeVault} disabled={busy}>
                Initialize Vault
              </button>
            </>
          )}

          {vaultReady === true && <DepositPanel wallet={wallet} onSuccess={connectPhantom} />}

          {signature && (
            <p>
              <a
                href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction on Solana Explorer
              </a>
            </p>
          )}
        </section>
      )}
    </main>
  );
}


