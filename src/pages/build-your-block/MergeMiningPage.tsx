import heroImage from '@/assets/guide-hero-merge-mining.png';
import {
  DocPage,
  DocHero,
  DocSection,
  DocText,
  DocList,
  DocTable,
  CodeBlock,
  Chip,
  DocFooterPrompt,
} from '@/components/docs/DocPrimitives';

const DMND_CLIENT_REPO = 'https://github.com/dmnd-pool/dmnd-client';

const RSK_PAYLOAD_LAYOUT = `ASCII "RSKBLOCK:"                 52534b424c4f434b3a
blockHashForMergedMining          32 bytes / 64 hexadecimal characters
complete payload                  41 bytes / 82 hexadecimal characters`;

const DECLARATION_FLOW = `one NewTemplate -> one miner-facing extended job -> one DeclareMiningJob
                -> one SetCustomMiningJob -> one pool job mapping`;

const CANONICAL_SCRIPT = 'OP_RETURN <one canonical push of the payload bytes>';

const SUCCESS_ENVELOPE = `{
  "success": true,
  "message": null,
  "data": {}
}`;

const ERROR_ENVELOPE = `{
  "success": false,
  "message": "human-readable error",
  "data": null
}`;

const OP_RETURN_REQUEST = `POST /api/coinbase/op-return
Content-Type: application/json`;

const OP_RETURN_BODY = `{
  "secret": "shared-api-secret",
  "data_hex": "52534b424c4f434b3a000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  "rsk_target_hex": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
}`;

const OP_RETURN_ACCEPTED = `{
  "success": true,
  "message": null,
  "data": {
    "payload_len_bytes": 41,
    "tx_out_len_bytes": 52,
    "replaced_pending": false
  }
}`;

const FOUND_JOB_REQUEST = 'GET /api/merge-mining/found-job?secret=shared-api-secret';

const FOUND_JOB_EMPTY = `{
  "success": true,
  "message": null,
  "data": null
}`;

const FOUND_JOB_BODY = `{
  "success": true,
  "message": null,
  "data": {
    "id": 42,
    "observed_at_unix_ts": 1784116800,
    "template_id": 9001,
    "version": 536870912,
    "header_timestamp": 1784116798,
    "header_nonce": 123456,
    "bitcoin_block_hash_hex": "<64 lowercase hex characters>",
    "block_header_hex": "<160 lowercase hex characters>",
    "coinbase_tx_hex": "<witness-stripped transaction hex>",
    "merkle_hashes_hex": [
      "<64 lowercase hex characters per sibling>"
    ],
    "block_tx_count": 2048,
    "op_return_payload_hex": "<82 lowercase hex characters>",
    "rsk_target_hex": "<64 lowercase hex characters>"
  }
}`;

const RAW_SELECTION = `p = last byte position of ASCII "RSKBLOCK:" in C
p must exist
C[p .. p + 41] must equal "RSKBLOCK:" || H
C.length - (p + 41) must be <= 128`;

const GET_WORK = `{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "mnr_getWork",
  "params": []
}`;

const PARTIAL_MERKLE_CALL = `mnr_submitBitcoinBlockPartialMerkle(
    work_hash_without_the_RSKBLOCK_tag,
    block_header_hex,
    witness_stripped_coinbase_tx_hex,
    "<coinbase txid> <sibling 1> <sibling 2> ...",
    lowercase_hex_block_tx_count_without_0x
)`;

const PARTIAL_MERKLE_PARAMS = `[
  "<64-char work hash>",
  "<160-char header>",
  "<coinbase transaction>",
  "<coinbase txid> <sibling 1> <sibling 2>",
  "800"
]`;

const RAW_BLOCK = 'raw_block_hex = block_header_hex || "01" || coinbase_tx_hex';

const SUBMIT_BLOCK = 'mnr_submitBitcoinBlock(raw_block_hex)';

const RSKJ_FLAGS = '-Drpc.modules.mnr.enabled=true -Dminer.server.enabled=true';

const PROXY_INVOCATION = `API_BIND_ADDRESS='127.0.0.1' \\
API_SECRET='<shared-secret>' \\
TOKEN='<DMND-token>' \\
cargo run -- -l info -d '<average-hashrate>T' --tp-address='127.0.0.1:8336'`;

const COMPANION_PATH = '../demand/rust-backend/services/demand-rsk-op-return-bridge/';

/**
 * Merge mining in dmnd: how RSK merge mining works in the proxy, and the wire
 * contract a bridge must satisfy.
 *
 * The samples here are operational: a bridge author copies them verbatim, so each
 * one is transcribed from the client's own MERGE_MINING.md rather than retyped.
 */
export function MergeMiningPage() {
  return (
    <DocPage title="Merge mining in dmnd">
      <DocHero src={heroImage} height={160} />

      <DocText>
        This document explains how RSK merge mining is implemented in this proxy and defines the wire contract for a
        bridge that connects the proxy to RskJ.
      </DocText>

      <DocText>The primary safety invariant is:</DocText>

      <DocText>
        Merge mining is optional. No merge-mining failure may invalidate Bitcoin work, suppress an otherwise valid
        Bitcoin share or block solution, disconnect miners, or bring down the proxy.
      </DocText>

      <DocText>
        The words MUST, MUST NOT, SHOULD, and MAY describe requirements for a compatible bridge. Details explicitly
        described as current limits are implementation details of this proxy.
      </DocText>

      <DocSection number="1" title="Architecture">
        <DocText>The integration has two independent directions:</DocText>
        <DocText>
          The proxy and bridge must run as separately supervised processes. The bridge may fail or restart without
          restarting <Chip>dmnd-client</Chip>; <Chip>dmnd-client</Chip> may lose RSK opportunities without interrupting
          Bitcoin mining.
        </DocText>
      </DocSection>

      <DocSection number="2" title="Enabling merge mining">
        <DocText>All of the following are required:</DocText>
        <DocList
          items={[
            <>
              <Chip>dmnd-client</Chip> runs in Job Declaration mode with <Chip>--tp-address</Chip> and a reachable
              Template Provider.
            </>,
            <>
              <Chip>API_SECRET</Chip> is non-empty and shared with the bridge.
            </>,
            'The Template Provider honors the additional coinbase-output capacity advertised by the proxy.',
            'The pool accepts every Bitcoin-consensus-valid template that also satisfies its ordinary token/tip policy.',
            'RskJ enables its merge-mining and miner RPC modules.',
          ]}
        />

        <DocText>
          Merge mining does not negotiate a private SV2 capability and does not require any pool or Job Declaration
          protocol change. Setup requests and responses use the ordinary upstream protocol; <Chip>flags = 0</Chip> is
          valid.
        </DocText>

        <DocText>
          An HTTP <Chip>202 Accepted</Chip> response does not prove that an RSK job was sent to miners. It means only
          that the pair is stored and available for a subsequent compatible <Chip>NewTemplate</Chip>.
        </DocText>

        <DocText>
          The proxy advertises 100 additional serialized coinbase-output bytes to the Template Provider. The standard
          RSK commitment consumes 52 bytes.
        </DocText>
      </DocSection>

      <DocSection number="3" title="How the proxy processes merge-mining work">
        <DocSection number="3.1" title="Desired pair" level={3}>
          <DocText>The bridge obtains work from RskJ and sends one atomic pair to the proxy:</DocText>
          <DocList
            items={[
              <>
                the <Chip>RSKBLOCK:</Chip> OP_RETURN payload; and
              </>,
              'the RSK target belonging to that exact payload.',
            ]}
          />
          <DocText>
            The most recently accepted pair remains active for later templates until another pair replaces it.
            Replacement never rewrites an older template: every template generation keeps the payload and target that
            were current when that generation was prepared.
          </DocText>
          <DocText>
            POSTing a pair does not request or synthesize a fresh Template Distribution template. The pair becomes
            eligible when a subsequent compatible <Chip>NewTemplate</Chip> is processed. Jobs already published for an
            older pair can remain valid and can produce found-job responses after a newer pair is installed.
          </DocText>
          <DocText>
            The desired pair survives Mining, Job Declaration, and Template Provider reconnects within the same{' '}
            <Chip>dmnd-client</Chip> process. It is not persisted across a complete process restart.
          </DocText>
        </DocSection>

        <DocSection number="3.2" title="Atomic template injection and pristine fallback" level={3}>
          <DocText>
            For each compatible Template Distribution <Chip>NewTemplate</Chip>, the proxy first keeps a pristine copy.
            It validates the complete MM change and then applies it to the one canonical template used by both the
            miner-facing job factory and Job Declaration. The original Template Distribution template ID is never
            replaced with a synthetic ID.
          </DocText>
          <DocText>The canonical template receives a zero-value output whose script is exactly:</DocText>
          <CodeBlock code={CANONICAL_SCRIPT} />
          <DocText>For RSK, the payload is exactly 41 bytes:</DocText>
          <CodeBlock code={RSK_PAYLOAD_LAYOUT} aligned />
          <DocText>
            The RskJ work hash is appended in the orientation returned by <Chip>mnr_getWork</Chip>; it is not reversed.
            The output leaves all existing outputs and <Chip>coinbase_tx_value_remaining</Chip> unchanged and increments
            the output count once.
          </DocText>
          <DocText>
            RskJ locates work by scanning the complete witness-stripped coinbase bytes without respecting
            transaction-field, output, or script boundaries. The last raw occurrence of <Chip>RSKBLOCK:</Chip> must
            begin the exact desired 41-byte payload, and no more than 128 bytes may follow the 32-byte work hash. The
            128-byte limit is inclusive and includes later output bytes and locktime. A newly appended final canonical
            output normally has only the four-byte locktime after its hash.
          </DocText>
          <DocText>The proxy still requires its own commitment to be a canonical OP_RETURN output:</DocText>
          <DocList
            items={[
              'if an existing exact canonical desired output also satisfies the raw last-tag and 128-byte rules, it is not duplicated;',
              <>
                if a different or hidden raw <Chip>RSKBLOCK:</Chip> follows it, or more than 128 bytes follow its hash,
                the desired canonical commitment is appended again;
              </>,
              'unrelated outputs remain byte-for-byte unchanged; and',
              <>
                an RSK work hash containing another raw <Chip>RSKBLOCK:</Chip> marker is rejected before it becomes
                active, because RskJ could not select the leading intended commitment unambiguously.
              </>,
            ]}
          />
          <DocText>
            Before publication, the proxy applies the raw scan again to the prospective serialized outputs plus
            locktime. This also rejects a later marker assembled across serialized field boundaries, such as a
            work-hash suffix combined with the locktime bytes.
          </DocText>
          <DocText>
            Injection is rejected if the output does not fit the reserved bytes, the existing outputs cannot be decoded,
            an SV2 field would overflow, MM state is unavailable, or the current coinbase converter could cross its safe
            one-byte output-count range. The proxy decodes and counts every output in the pool token and permits
            injection only when <Chip>{'template outputs + pool outputs <= 252'}</Chip>. With the current one-output
            pool token, the canonical template may contain at most 251 outputs. A token with multiple outputs lowers
            that limit accordingly, and the same full output set is used by the miner job and Job Declaration. The exact
            canonical desired RSK output is accepted idempotently when it satisfies the raw-selection rules and the
            final combined count is safe. If another output cannot be appended safely, the byte-for-byte pristine
            template is used for the one normal Bitcoin job, as it is on every other pre-publication MM failure.
          </DocText>
          <DocText>
            The modified candidate is also passed through a throwaway instance of the pinned coinbase job builder with
            every pool output and the live channel&rsquo;s extranonce length. This verifies the complete miner-facing
            coinbase prefix and suffix, not only the Template Distribution output field. The throwaway builder cannot
            mutate the live channel factory. If either complete field cannot fit its <Chip>B064K</Chip> representation,
            the unpublished MM generation is discarded and the byte-for-byte pristine template is published once through
            the ordinary flow.
          </DocText>
        </DocSection>

        <DocSection number="3.3" title="One ordinary Job Declaration flow" level={3}>
          <DocText>Every processed template produces only the existing normal sequence:</DocText>
          <CodeBlock code={DECLARATION_FLOW} aligned />
          <DocText>
            There is no optional token, second declaration, second custom job, capability gate, delayed upgrade, or
            replacement notify. The declaration uses the coinbase prefix and suffix from that exact miner-facing job.
            Custom-job responses are correlated by request ID, then map the exact local miner job ID to its accepted
            pool job ID; template IDs are not used as a latest-job shortcut.
          </DocText>
          <DocText>
            On <Chip>SetNewPrevHash</Chip>, the proxy records immutable MM chain context first and then preserves the
            existing orchestration order: start the Job Declarator transition before publishing the matching prevhash to
            miners. It does not wait for the pool response before publication.
          </DocText>
          <DocText>
            The existing proxy publishes miner work before the ordinary declaration/custom-job exchange has completed.
            This design therefore relies on the deployment requirement above: the pool accepts any
            Bitcoin-consensus-valid template under its normal token/tip rules. The injected zero-value canonical
            OP_RETURN is locally validated before publication and fits the pool&rsquo;s advertised 100-byte allowance. A
            later token, tip, transport, or generic JD rejection is an ordinary Job Declaration failure that can affect
            a clean job in the same way; it is not handled by a second MM attempt.
          </DocText>
        </DocSection>

        <DocSection number="3.4" title="Immutable job context" level={3}>
          <DocText>Every published RSK job is bound to one immutable template generation containing:</DocText>
          <DocTable
            headers={['Value', 'Source']}
            rows={[
              ['Template ID', <Chip>NewTemplate.template_id</Chip>],
              ['Payload and target', 'Atomic pair applied to that generation'],
              ['Merkle siblings', <Chip>NewTemplate.merkle_path</Chip>],
              ['Transaction count', <Chip>RequestTransactionDataSuccess.transaction_list.length + 1</Chip>],
              [
                <>
                  Previous block hash and <Chip>nBits</Chip>
                </>,
                <>
                  Matching <Chip>SetNewPrevHash</Chip>
                </>,
              ],
              ['Coinbase prefix and suffix', 'Accepted live miner job'],
              ['Miner job binding', 'Exact miner-facing extended job'],
            ]}
          />
          <DocText>
            The transaction count includes the coinbase and is never inferred from merkle-path length. Non-future
            templates inherit the active chain state, which covers the normal{' '}
            <Chip>SetNewPrevHash(A) -&gt; NewTemplate(B, future=false)</Chip> refresh. Future templates remain
            incomplete until their matching <Chip>SetNewPrevHash</Chip> arrives. A job binding immediately retains its
            immutable template context; no pending-upgrade pin or second publication phase exists.
          </DocText>
          <DocText>
            Reused template or job IDs are separated by local generations. The transaction-data request keeps the
            generation selected when the request was made; its response writes the transaction count once to that
            generation rather than looking up a reusable template ID later. A share never falls back to the newest
            template or to context belonging to another job. Miner-job announcements are matched by job ID and stale
            earlier announcements are discarded deliberately, so one missing job cannot shift every later merge-mining
            binding.
          </DocText>
          <DocText>
            The context behind the last miner-facing notify, the selected future job awaiting its prevhash, and
            bindings already queued for ordered notify delivery are protected from bounded-history eviction. Claiming a
            binding and applying that protection is atomic; when future-job coalescing replaces a future, the discarded
            binding is released. Once a newer notify becomes active, older inactive contexts are eligible for normal
            retirement. If every bounded slot is temporarily protected, the incoming template remains pristine and
            Bitcoin-only instead of evicting context that a miner can use.
          </DocText>
        </DocSection>

        <DocSection number="3.5" title="Share observation and proof construction" level={3}>
          <DocText>
            After authentication and structural validation, the proxy offers each submitted share to a bounded RSK
            observer before normal Bitcoin-difficulty filtering. The offer uses a nonblocking queue. A full or
            unavailable observer loses only that RSK observation.
          </DocText>
          <DocText>For an observed share, the worker:</DocText>
          <DocList
            items={[
              'resolves its exact job binding and immutable template snapshot;',
              'reconstructs the full extranonce as channel extranonce1 plus submitted extranonce2;',
              <>
                reconstructs and deserializes <Chip>coinbase_prefix || full_extranonce || coinbase_suffix</Chip>;
              </>,
              <>
                verifies that the expected payload is the last canonical <Chip>RSKBLOCK:</Chip> commitment;
              </>,
              <>
                clears all coinbase input witness stacks, serializes the coinbase once, and verifies that the expected
                payload starts at the last raw <Chip>RSKBLOCK:</Chip> occurrence with at most 128 trailing bytes;
              </>,
              'computes the witness-stripped coinbase txid;',
              "reconstructs the merkle root from the template's bottom-up sibling path;",
              <>
                builds the 80-byte Bitcoin header from the share version, timestamp and nonce plus the exact prevhash,
                merkle root and <Chip>nBits</Chip>;
              </>,
              'compares the header hash numerically with the template-scoped RSK target; and',
              <>
                enqueues the proof only when <Chip>{'bitcoin_block_hash <= rsk_target'}</Chip>.
              </>,
            ]}
          />
          <DocText>
            This side path never changes the result of normal Bitcoin share validation. A share or solution continues
            through its configured Bitcoin relay and block-submission paths even if every RSK step fails.
          </DocText>
        </DocSection>

        <DocSection number="3.6" title="Current bounds and failure policy" level={3}>
          <DocTable
            headers={['State', 'Current bound', 'Overflow/failure behavior']}
            rows={[
              [
                'Template generations',
                '128',
                'Retire inactive old context; never evict active/queued work; otherwise use the pristine incoming template',
              ],
              ['Job bindings', '256', 'Retire inactive old RSK reconstruction context'],
              ['Job announcements', '256', 'Retire the oldest announcement'],
              ['Observer queue', '128', 'Drop the RSK observation without delaying the share'],
              ['Early shares awaiting context', '64', 'Drop the oldest RSK observation'],
              ['Found-job FIFO', '32', 'Drop the oldest proof candidate'],
              ['Recent proof identities', '128', 'Retire the oldest deduplication identity'],
            ]}
          />
          <DocText>
            An unavailable observer makes the merge-mining API unavailable. If it is unavailable while a new template is
            being prepared, the proxy uses the pristine Bitcoin template. If it fails after a job was bound, later
            observations may be lost, but the job, Bitcoin shares, and Bitcoin block solution path are unchanged. A
            thread-spawn failure is retried after a five-second backoff; an unexpected worker exit is retried on the
            next operation that needs it. API bind failures likewise leave mining active and retry every five seconds;
            an API serve failure retries after one second.
          </DocText>
        </DocSection>
      </DocSection>

      <DocSection number="4" title="Bridge-facing HTTP contract">
        <DocText>Both endpoints use JSON and the envelope:</DocText>
        <CodeBlock code={SUCCESS_ENVELOPE} />
        <DocText>An application error uses:</DocText>
        <CodeBlock code={ERROR_ENVELOPE} />
        <DocText>
          A bridge <strong className="font-medium text-foreground">MUST</strong> treat a non-2xx status, malformed JSON,{' '}
          <Chip>success: false</Chip>, or missing required success data as a failed call.
        </DocText>

        <DocSection number="4.1" title="Set the desired payload and target" level={3}>
          <CodeBlock code={OP_RETURN_REQUEST} />
          <CodeBlock code={OP_RETURN_BODY} />
          <DocText>Request fields:</DocText>
          <DocTable
            headers={['Field', 'Requirements']}
            rows={[
              [
                <Chip>secret</Chip>,
                <>
                  Exact value of the proxy&rsquo;s non-empty <Chip>API_SECRET</Chip>
                </>,
              ],
              [
                <Chip>data_hex</Chip>,
                <>
                  Non-empty, even-length hex without <Chip>0x</Chip>, maximum 80 decoded bytes
                </>,
              ],
              [
                <Chip>rsk_target_hex</Chip>,
                <>
                  Exactly 32 bytes of big-endian display hex; <Chip>0x</Chip> or <Chip>0X</Chip> is accepted
                </>,
              ],
            ]}
          />
          <DocText>
            The generic endpoint accepts payloads up to 80 bytes, but only exactly <Chip>RSKBLOCK:</Chip> followed by
            one 32-byte work hash can produce RSK proof jobs. That 32-byte hash must not itself contain the nine-byte{' '}
            <Chip>RSKBLOCK:</Chip> marker, because RskJ selects the last raw marker in the coinbase.
          </DocText>
          <DocText>
            Success is <Chip>202 Accepted</Chip> after the pair has been stored atomically:
          </DocText>
          <CodeBlock code={OP_RETURN_ACCEPTED} />
          <DocText>
            <Chip>replaced_pending</Chip> is true whenever any desired pair was already stored, including an identical
            pair. Reposting is valid and does not duplicate a commitment in one template.
          </DocText>
          <DocText>Actual error statuses are:</DocText>
          <DocTable
            headers={['Status', 'Meaning', 'State change']}
            rows={[
              [
                <Chip>400 Bad Request</Chip>,
                'Missing/invalid target, malformed or ambiguous RSK payload, or output cannot be represented',
                'None',
              ],
              [<Chip>401 Unauthorized</Chip>, 'Wrong secret', 'None'],
              [
                <Chip>503 Service Unavailable</Chip>,
                <>
                  <Chip>API_SECRET</Chip> is absent/empty or the RSK observer/state is unavailable
                </>,
                'None',
              ],
            ]}
          />
          <DocText>
            Malformed JSON may be rejected by the HTTP framework with another non-success response.
          </DocText>
        </DocSection>

        <DocSection number="4.2" title="Poll one found job" level={3}>
          <CodeBlock code={FOUND_JOB_REQUEST} />
          <DocText>An empty queue is successful:</DocText>
          <CodeBlock code={FOUND_JOB_EMPTY} />
          <DocText>A non-empty response contains one job:</DocText>
          <CodeBlock code={FOUND_JOB_BODY} />
          <DocText>Field requirements:</DocText>
          <DocTable
            headers={['Field', 'Contract']}
            rows={[
              [<Chip>id</Chip>, 'Positive identifier unique during this proxy process lifetime'],
              [<Chip>observed_at_unix_ts</Chip>, 'UTC Unix seconds when the proxy observed the share'],
              [<Chip>template_id</Chip>, 'Exact Template Distribution template used for reconstruction'],
              [<Chip>version</Chip>, 'Submitted Bitcoin header version; diagnostic'],
              [<Chip>header_timestamp</Chip>, 'Submitted header timestamp; diagnostic'],
              [<Chip>header_nonce</Chip>, 'Submitted header nonce; diagnostic'],
              [<Chip>bitcoin_block_hash_hex</Chip>, 'Exactly 32 bytes in standard Bitcoin display order'],
              [<Chip>block_header_hex</Chip>, 'Exactly 80 consensus-serialized Bitcoin header bytes'],
              [<Chip>coinbase_tx_hex</Chip>, 'One valid witness-stripped Bitcoin transaction'],
              [<Chip>merkle_hashes_hex</Chip>, 'Coinbase sibling hashes only, in the format below'],
              [
                <Chip>block_tx_count</Chip>,
                <>
                  Total block transactions including coinbase, <Chip>1..=2147483647</Chip>
                </>,
              ],
              [<Chip>op_return_payload_hex</Chip>, 'Exact applied 41-byte RSK payload'],
              [<Chip>rsk_target_hex</Chip>, 'Exact applied 32-byte big-endian display target'],
            ]}
          />
          <DocText>
            The GET is a destructive FIFO operation: <Chip>200</Chip> with an object atomically removes that object.{' '}
            <Chip>200</Chip> with <Chip>data: null</Chip> means empty. Authentication or internal failures do not
            intentionally pop an item.
          </DocText>
          <DocText>
            Delivery is at-most-once. If the HTTP response is lost after the proxy removes the item, the proxy does not
            deliver it again. A bridge therefore owns a job as soon as it receives a successful object and{' '}
            <strong className="font-medium text-foreground">MUST</strong> keep that job in its own bounded retry state
            until RskJ accepts it, the job expires, or a terminal error makes it unusable.
          </DocText>
          <DocText>
            An ambiguous GET failure must not be treated as a retry of the same queue item: a later GET may pop the next
            item because the first may already have been removed. The bridge should continue normal polling and accept
            that the response-lost candidate is unrecoverable. It should also ignore unknown response fields so additive
            proxy changes remain compatible.
          </DocText>
        </DocSection>
      </DocSection>

      <DocSection number="5" title="Byte order and proof validation">
        <DocText>
          A production bridge <strong className="font-medium text-foreground">MUST</strong> validate a found job before
          submitting it to RskJ. At minimum:
        </DocText>
        <DocList
          items={[
            'normalize all fixed-width hashes to lowercase 64-character hex;',
            <>
              require an 80-byte <Chip>block_header_hex</Chip> and recompute its double-SHA256 display hash;
            </>,
            <>
              require the recomputed hash to equal <Chip>bitcoin_block_hash_hex</Chip>;
            </>,
            <>
              require the numeric block hash to be less than or equal to <Chip>rsk_target_hex</Chip>;
            </>,
            'deserialize exactly one coinbase transaction and reject witness-bearing serialization;',
            <>
              require the expected payload to be the last canonical <Chip>RSKBLOCK:</Chip> output and to start at the
              last raw tag in the witness-stripped serialization;
            </>,
            'compute the witness-stripped coinbase txid;',
            'reconstruct the merkle root and compare it with the header; and',
            'validate the transaction count and exact sibling count; and',
            'require at most 128 bytes after the selected 32-byte RSK work hash.',
          ]}
        />
        <DocText>
          The companion <Chip>demand-rsk-op-return-bridge</Chip> is interoperable with the current proxy, but it does
          not yet perform every independent check above. In particular, it trusts the proxy and RskJ for the
          header-hash, last-commitment, and reconstructed-merkle-root checks. A new production bridge should not copy
          that trust shortcut unless the proxy connection is inside the same trusted failure domain; RskJ rejection
          still affects only merge-mining submission and never Bitcoin processing.
        </DocText>
        <DocText>
          The companion bridge&rsquo;s pending proof retry <Chip>VecDeque</Chip> also has no hard item cap. Job expiry
          limits retention time but not the maximum number of retained jobs. It is therefore not production conformant
          with this document&rsquo;s bounded-state requirement until that queue has a hard cap and a documented eviction
          policy. This does not consume proxy memory or affect Bitcoin mining.
        </DocText>

        <DocSection number="5.1" title="Header layout" level={3}>
          <DocText>
            <Chip>block_header_hex</Chip> is the normal Bitcoin consensus header:
          </DocText>
          <DocTable
            headers={['Bytes', 'Value', 'Encoding']}
            rows={[
              [<Chip>0..4</Chip>, 'version', <>little-endian <Chip>u32</Chip></>],
              [<Chip>4..36</Chip>, 'previous block hash', 'raw Bitcoin header byte order'],
              [<Chip>36..68</Chip>, 'merkle root', 'raw Bitcoin header byte order'],
              [<Chip>68..72</Chip>, 'timestamp', <>little-endian <Chip>u32</Chip></>],
              [<Chip>72..76</Chip>, <Chip>nBits</Chip>, <>little-endian <Chip>u32</Chip></>],
              [<Chip>76..80</Chip>, 'nonce', <>little-endian <Chip>u32</Chip></>],
            ]}
          />
          <DocText>
            The raw <Chip>SetNewPrevHash.prev_hash</Chip> bytes are already in header order and must not be reversed
            again. <Chip>bitcoin_block_hash_hex</Chip> and <Chip>rsk_target_hex</Chip> are fixed-width, big-endian
            display values.
          </DocText>
        </DocSection>

        <DocSection number="5.2" title="Merkle siblings" level={3}>
          <DocText>
            <Chip>merkle_hashes_hex</Chip> contains:
          </DocText>
          <DocList
            items={[
              'siblings only, never the coinbase txid;',
              'bottom-up order from the coinbase leaf to the root;',
              'one 32-byte lowercase string per sibling;',
              'standard Bitcoin display order, reversed from the raw SV2 merkle-path bytes; and',
              <>
                exactly the tree height obtained by repeatedly applying <Chip>width = ceil(width / 2)</Chip> until one
                node remains.
              </>,
            ]}
          />
          <DocText>
            For <Chip>block_tx_count == 1</Chip>, the array must be empty and the header merkle root must equal the
            witness-stripped coinbase txid.
          </DocText>
        </DocSection>

        <DocSection number="5.3" title="RskJ raw commitment selection" level={3}>
          <DocText>
            Let <Chip>C</Chip> be the complete witness-stripped consensus serialization of the coinbase and{' '}
            <Chip>H</Chip> the 32-byte work hash from this found job. A compatible producer or validating bridge must
            apply:
          </DocText>
          <CodeBlock code={RAW_SELECTION} />
          <DocText>
            The scan is byte-oriented across all fields and scripts; a marker can therefore occur in a non-OP_RETURN
            script or span a serialization boundary. Witness bytes are excluded. The bound is inclusive: 128 trailing
            bytes pass and 129 fail. The proxy separately requires its intended output to use the canonical OP_RETURN
            form before it publishes RSK-bound work.
          </DocText>
        </DocSection>
      </DocSection>

      <DocSection number="6" title="RskJ-facing bridge contract">
        <DocSection number="6.1" title="Fetch work" level={3}>
          <DocText>Call JSON-RPC 2.0:</DocText>
          <CodeBlock code={GET_WORK} />
          <DocText>
            Use HTTP POST with JSON. A bridge must correlate the response ID, reject a JSON-RPC <Chip>error</Chip>, and
            accept work only from a successfully decoded <Chip>result</Chip>.
          </DocText>
          <DocText>The result must provide:</DocText>
          <DocTable
            headers={['Field', 'Contract']}
            rows={[
              [<Chip>blockHashForMergedMining</Chip>, 'Exactly 32 bytes of hex'],
              [<Chip>target</Chip>, 'Exactly 32 bytes of big-endian target hex'],
              [<Chip>notify</Chip>, 'Informational boolean; it is not part of the atomic pair'],
            ]}
          />
          <DocText>
            Build <Chip>data_hex</Chip> as lowercase hex of ASCII <Chip>RSKBLOCK:</Chip> followed immediately by the
            normalized work hash. Do not byte-reverse the work hash. A missing or malformed target makes this work
            unusable; do not POST a partial pair.
          </DocText>
          <DocText>
            Only remember a pair as installed after the proxy returns a valid <Chip>202</Chip> success envelope with all
            three metadata fields. Retry failed delivery. Reposting the same pair is safe.
          </DocText>
        </DocSection>

        <DocSection number="6.2" title="Submit a multi-transaction proof" level={3}>
          <DocText>
            When <Chip>{'block_tx_count > 1'}</Chip>, call:
          </DocText>
          <CodeBlock code={PARTIAL_MERKLE_CALL} />
          <DocText>
            Derive <Chip>work_hash_without_the_RSKBLOCK_tag</Chip> from this found job&rsquo;s{' '}
            <Chip>op_return_payload_hex</Chip>, not from the bridge&rsquo;s newest cached work. A proof can legitimately
            belong to an older pair. Keep payload and <Chip>rsk_target_hex</Chip> scoped to the found job, and never
            substitute either value from current work. The bridge may submit an older proof while RskJ still recognizes
            that work hash; a terminal &ldquo;work not found&rdquo; response retires it.
          </DocText>
          <DocText>
            The proxy-to-bridge values remain in standard Bitcoin display order. At the RskJ RPC boundary, the bridge
            derives the witness-stripped coinbase txid and byte-reverses it and every proxy-provided sibling into raw
            hash order. The sibling order remains bottom-up and unchanged. This compensates for VETIVER&rsquo;s RSKIP92
            proof builder reversing each submitted value internally. The sibling list from the proxy itself never
            contains the coinbase txid.
          </DocText>
          <DocText>
            The equivalent JSON-RPC <Chip>params</Chip> value is:
          </DocText>
          <CodeBlock code={PARTIAL_MERKLE_PARAMS} />
          <DocText>
            The final example value is hexadecimal transaction count <Chip>0x800</Chip> without the prefix.
          </DocText>
        </DocSection>

        <DocSection number="6.3" title="Submit a coinbase-only block" level={3}>
          <DocText>
            When <Chip>block_tx_count == 1</Chip>, construct:
          </DocText>
          <CodeBlock code={RAW_BLOCK} />
          <DocText>
            <Chip>01</Chip> is the CompactSize transaction count. Submit it with:
          </DocText>
          <CodeBlock code={SUBMIT_BLOCK} />
        </DocSection>

        <DocSection number="6.4" title="Retry and queue policy" level={3}>
          <DocText>
            After destructive GET, RskJ submission errors belong entirely to the bridge. A production bridge{' '}
            <strong className="font-medium text-foreground">MUST</strong> hard-bound its locally owned proof queue and
            define which job is evicted on overflow. It{' '}
            <strong className="font-medium text-foreground">SHOULD</strong> also:
          </DocText>
          <DocList
            items={[
              'use bounded connection and request timeouts;',
              'retry transport errors and transient JSON-RPC failures with bounded backoff;',
              'apply a longer cooldown for RskJ rate limiting;',
              'stop retrying malformed proofs, invalid blocks, expired work, or work RskJ no longer recognizes;',
              'bound the number of destructive GETs and RskJ submissions attempted per polling tick;',
              'deduplicate jobs for the same RSK work payload;',
              <>
                continue fetching newer <Chip>mnr_getWork</Chip> while older proof submission is retrying; and
              </>,
              'process locally owned proofs even when a later proxy poll fails.',
            ]}
          />
          <DocText>
            Use <Chip>observed_at_unix_ts</Chip> to expire jobs. Synchronize the bridge and proxy hosts with NTP or
            chrony.
          </DocText>
        </DocSection>
      </DocSection>

      <DocSection number="7" title="Restart and resynchronization">
        <DocText>
          The proxy keeps the desired pair only in process memory. A bridge that suppresses an unchanged pair after one
          successful POST can leave a restarted proxy without RSK work indefinitely.
        </DocText>
        <DocText>
          A compatible deployment <strong className="font-medium text-foreground">MUST</strong> provide one
          resynchronization mechanism:
        </DocText>
        <DocList
          items={[
            <>
              restart the bridge after every full <Chip>dmnd-client</Chip> restart; or
            </>,
            'make the bridge periodically repost the current pair; or',
            "detect a new proxy process/session and clear the bridge's last-installed cache.",
          ]}
        />
        <DocText>
          A simple deployment uses separate supervisors and restarts the bridge after the proxy is healthy. Internal
          upstream reconnects do not require a repost because the proxy retains the desired pair and clears only
          session-scoped bindings.
        </DocText>
      </DocSection>

      <DocSection number="8" title="Security and deployment">
        <DocText>
          The merge-mining endpoints use a shared secret but provide no TLS. The GET contract places that secret in the
          query string. A production deployment must:
        </DocText>
        <DocList
          items={[
            <>
              set <Chip>API_BIND_ADDRESS=127.0.0.1</Chip> when the bridge is on the same host;
            </>,
            'keep the API on a trusted private network or behind an authenticated TLS reverse proxy;',
            'firewall it from the public internet;',
            'avoid logging full GET URLs or query strings;',
            <>
              use the same strong secret for <Chip>API_SECRET</Chip> and the bridge credential; and
            </>,
            'supervise the bridge independently from the proxy.',
          ]}
        />
        <DocText>RskJ must be started with:</DocText>
        <CodeBlock code={RSKJ_FLAGS} />
        <DocText>Example proxy invocation:</DocText>
        <CodeBlock code={PROXY_INVOCATION} />
        <DocText>A bridge may use these configuration names, matching the companion implementation:</DocText>
        <DocTable
          headers={['Variable', 'Required', 'Typical/default value']}
          rows={[
            [<Chip>RSK_RPC_URL</Chip>, 'Yes', <Chip>http://127.0.0.1:4444</Chip>],
            [
              <Chip>DMND_CLIENT_API_SECRET</Chip>,
              'Yes',
              <>
                Same value as <Chip>API_SECRET</Chip>
              </>,
            ],
            [
              <Chip>DMND_CLIENT_OP_RETURN_URL</Chip>,
              'No',
              <Chip>http://127.0.0.1:3001/api/coinbase/op-return</Chip>,
            ],
            [
              <Chip>DMND_CLIENT_FOUND_JOB_URL</Chip>,
              'No',
              <Chip>http://127.0.0.1:3001/api/merge-mining/found-job</Chip>,
            ],
            [<Chip>RSK_POLL_INTERVAL_SECS</Chip>, 'No', <Chip>1</Chip>],
            [<Chip>FOUND_JOB_POLL_INTERVAL_SECS</Chip>, 'No', <Chip>1</Chip>],
            [<Chip>JOB_RETRY_INTERVAL_SECS</Chip>, 'No', <Chip>5</Chip>],
            [<Chip>FOUND_JOB_MAX_AGE_SECS</Chip>, 'No', <Chip>600</Chip>],
          ]}
        />
        <DocText>
          These environment-variable names are not part of the wire protocol; another bridge may expose equivalent
          configuration differently.
        </DocText>
      </DocSection>

      <DocSection number="9" title="Known miner-target limitation">
        <DocText>
          This proxy deliberately never lowers a miner&rsquo;s normal Bitcoin share difficulty. It evaluates every
          authenticated, structurally valid share it receives before the normal Bitcoin-difficulty filter, so an
          RSK-valid submitted share is not hidden by a harder upstream filter.
        </DocText>
        <DocText>
          An ASIC, however, reports only hashes that satisfy the target assigned to it. If the RSK target is easier than
          the miner&rsquo;s assigned target, some hashes can satisfy RSK while never being submitted by the ASIC. The
          proxy and bridge cannot observe or recover those hashes.
        </DocText>
        <DocText>
          This is an intentional stability-first policy: merge mining does not change miner traffic or normal Bitcoin
          difficulty. It is a known deviation from a design that guarantees observation of every RSK-valid hash. A
          bridge implementation cannot remove this limitation.
        </DocText>
      </DocSection>

      <DocSection number="10" title="Bridge conformance checklist">
        <DocText>A bridge is compatible when it verifies all of the following:</DocText>
        <DocList
          items={[
            <>
              It constructs exactly <Chip>RSKBLOCK:</Chip> plus the 32-byte RskJ work hash without reversal.
            </>,
            'It sends the matching 32-byte target in the same POST and never installs half a pair.',
            <>
              It treats only <Chip>202</Chip> plus a valid success envelope as successful installation.
            </>,
            'It retries failed pair delivery and provides restart resynchronization.',
            <>
              It treats <Chip>data: null</Chip> from GET as an empty queue, not an error.
            </>,
            'It understands that GET is destructive and retains fetched jobs in bounded local retry state.',
            'It validates header length/hash, target, the canonical output, the last raw RSK tag, the inclusive 128-byte trailing limit, transaction count, merkle path length, and reconstructed merkle root.',
            'It derives the RskJ work hash from each found job and does not mix old proof context with the newest cached pair.',
            <>
              It submits single-transaction blocks with <Chip>mnr_submitBitcoinBlock</Chip>.
            </>,
            <>
              It submits multi-transaction proofs with the exact RSKIP92 hash order and{' '}
              <Chip>mnr_submitBitcoinBlockPartialMerkle</Chip> parameters above.
            </>,
            'It retries only transient RskJ failures, expires old work, and bounds rate-limit pressure.',
            "It never sends bridge failures back into the proxy's Bitcoin lifecycle.",
            'Operators have verified one declaration, one custom-job request, and one miner job per affected template, with no private capability flag or delayed second flow.',
            'Operators understand and accept the miner-target limitation above.',
          ]}
        />
      </DocSection>

      <DocSection number="11" title="Current implementation map">
        <DocTable
          headers={['Area', 'Source']}
          rows={[
            ['HTTP route registration', <Chip>src/api/mod.rs</Chip>],
            [
              'Pair validation, template state, reconstruction, queues and API handlers',
              <Chip>src/merge_mining.rs</Chip>,
            ],
            ['Atomic template injection and pristine fallback', <Chip>src/jd_client/template_receiver/mod.rs</Chip>],
            ['Single ordinary declaration flow', <Chip>src/jd_client/job_declarator/mod.rs</Chip>],
            ['Exact custom-job response correlation', <Chip>src/jd_client/mining_upstream/upstream.rs</Chip>],
            [
              'Miner job binding, chain context and Bitcoin solution isolation',
              <Chip>src/jd_client/mining_downstream/mod.rs</Chip>,
            ],
            ['Pre-difficulty, nonblocking share observation', <Chip>src/translator/downstream/downstream.rs</Chip>],
          ]}
        />
        <DocText>
          The companion implementation and its deeper behavioral test specification live at:
        </DocText>
        <CodeBlock code={COMPANION_PATH} />
      </DocSection>

      <DocFooterPrompt href={DMND_CLIENT_REPO} />
    </DocPage>
  );
}
