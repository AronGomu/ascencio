# Card Images

> Status: implemented DOM image lifecycle; distribution review required

Active-deck images remain verified and cached as blobs. DOM consumers acquire snapshot-and-code-scoped leases only while art is mounted; final release revokes each object URL. Image loading status is diagnostic only and never gates legal input.

## Coverage and delivery

- Maintain a versioned card-code-to-image manifest for every supported catalog ID.
- Keep the multi-gigabyte image archive outside the JavaScript bundle and source Git.
- Serve approved images from project-controlled static hosting rather than continual provider hotlinking.
- Preload/verify active-deck blobs with bounded concurrency, but never block a legal prompt on image or storage I/O; render card backs/placeholders immediately.
- Create object URLs lazily for mounted/soon-visible DOM images. Deduplicate leases by snapshot+card code and revoke after final consumer, generation replacement, restart, or disposal.
- Use native asynchronous image decoding. Decode/load failure returns that element to deterministic placeholder art without changing prompt legality.

## Rendering and privacy

Render face-up images in field/hand/inspector/GY/banished/Extra Deck/prompt surfaces as applicable. Use a card back for hidden cards and a deterministic placeholder for unavailable IDs.

## Cache behavior

Use snapshot/provider-aware Cache Storage keys, deduplicate concurrent requests, validate manifest digest/length/content/dimensions/decode before persistence, evict invalid cache entries, tolerate provider outages with placeholders, and keep verified blobs separate from mounted object-URL leases. Network/decode work is bounded by byte, concurrency, cancellation, and timeout limits. Hidden identities never trigger image lookup or URL creation.

Technical availability is not permission to redistribute; see [`../07-governance/licensing-and-distribution.md`](../07-governance/licensing-and-distribution.md).
