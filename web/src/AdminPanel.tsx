import { useEffect, useState } from 'react';
import { Buffer } from 'buffer';
import {
  Connection, PublicKey, SystemProgram,
  SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction
} from '@solana/web3.js';
import idl from './idl/simple_vault.json';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const programId = new PublicKey(idl.address);

const tokenA = new PublicKey('ADaNt9CjREvjP9DeYs2JK4CNrw3FAeDFvJW1KHTyXd2Z');
const tokenB = new PublicKey('3QFjgynxLMHPE5yihHrsAoPtG3ksKK5jHVoTRsmBA2cD');

const tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

const [vault] = PublicKey.findProgramAddressSync(
  [Buffer.from('vault'), tokenA.toBuffer()], programId
);

const [vaultTokenB] = PublicKey.findProgramAddressSync(
  [Buffer.from('vault_tokens_b'), tokenA.toBuffer()], programId
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

export default function AdminPanel({ wallet }: { wallet: string }) {
  const [admin, setAdmin] = useState('');
  const [ready, setReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [signature, setSignature] = useState('');

  useEffect(() => {
    async function check() {
      try {
        const [vaultInfo, pairInfo] = await Promise.all([
          connection.getAccountInfo(vault),
          connection.getAccountInfo(vaultTokenB),
        ]);

        if (!vaultInfo || !vaultInfo.owner.equals(programId) ||
            vaultInfo.data.length < 40) {
          throw new Error('Vault account is missing or invalid.');
        }

        const adminAddress = new PublicKey(
          vaultInfo.data.subarray(8, 40)
        ).toBase58();

        setAdmin(adminAddress);
        setReady(pairInfo !== null);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Check failed.');
      }
    }

    void check();
  }, [wallet]);

  async function addTokenB() {
    const phantom = getPhantom();

    if (!phantom) {
      setStatus('Phantom not found.');
      return;
    }

    try {
      setBusy(true);
      setSignature('');
      setStatus('Preparing Token B account...');

      const { publicKey: signer } = await phantom.connect();

      if (signer.toBase58() !== wallet ||
          signer.toBase58() !== admin) {
        throw new Error('Only the Vault admin can add Token B.');
      }

      const [existing, mintInfo] = await Promise.all([
        connection.getAccountInfo(vaultTokenB),
        connection.getAccountInfo(tokenB),
      ]);

      if (existing) {
        setReady(true);
        setStatus('Token B account already exists.');
        return;
      }

      if (!mintInfo || !mintInfo.owner.equals(tokenProgram)) {
        throw new Error('Token B mint is missing or invalid.');
      }

      const ix = idl.instructions.find(
        instruction => instruction.name === 'add_pair_token'
      );

      if (!ix || ix.discriminator.length !== 8) {
        throw new Error('add_pair_token instruction not found.');
      }

      const instruction = new TransactionInstruction({
        programId,
        keys: [
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: tokenB, isSigner: false, isWritable: false },
          { pubkey: vaultTokenB, isSigner: false, isWritable: true },
          { pubkey: signer, isSigner: true, isWritable: true },
          { pubkey: tokenProgram, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(ix.discriminator),
      });

      const latest = await connection.getLatestBlockhash('confirmed');

      const transaction = new Transaction({
        feePayer: signer,
        recentBlockhash: latest.blockhash,
      }).add(instruction);

      setStatus('Confirm Add Token B in Phantom (Devnet).');

      const result = await phantom.signAndSendTransaction(transaction);
      setSignature(result.signature);

      setStatus('Waiting for transaction confirmation...');

      const confirmation = await connection.confirmTransaction({
        signature: result.signature,
        ...latest,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction failed on Devnet.');
      }

      const account = await connection.getAccountInfo(vaultTokenB);

      if (!account) {
        throw new Error('Transaction confirmed, but Token B account is not visible yet.');
      }

      setReady(true);
      setStatus('Token B successfully added to Vault!');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to add Token B.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 30, textAlign: 'left' }}>
      <hr />
      <h2>Admin Dashboard</h2>

      <p>Pair Token: TOKEN B</p>
      <p>Status: {
        ready === null ? 'Checking...' :
        ready ? 'Connected' : 'Not connected'
      }</p>

      <p style={{ overflowWrap: 'anywhere' }}>
        Admin: {admin || 'Loading...'}
      </p>

      {ready === false && wallet === admin && (
        <button onClick={addTokenB} disabled={busy}>
          Add Token B
        </button>
      )}

      {ready === false && admin && wallet !== admin && (
        <p>Only the Vault admin can add Token B.</p>
      )}

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
