# Card Images

> Status: accepted target; migration pending; distribution review required

Current baseline verifies and caches active-deck images for the Phaser field, creates eager object URLs, and retains image-dependent field/input gates. DF-13 migrates to mounted-image leases and makes legal input independent of image readiness.

## Coverage and delivery

- Maintain a versioned card-code-to-image manifest for every supported catalog ID.
- Keep the multi-gigabyte image archive outside the JavaScript bundle and source Git.
- Serve approved images from project-controlled static hosting rather than continual provider hotlinking.
- Preload/verify active-deck blobs with bounded concurrency, but never block a legal prompt on image or storage I/O; use placeholders until art is ready.
- Create object URLs lazily for mounted/soon-visible DOM images. Deduplicate leases by snapshot+card code and revoke after final consumer, generation replacement, restart, or disposal.

## Rendering and privacy

Render face-up images in field/hand/inspector/GY/banished/Extra Deck/prompt surfaces as applicable. Use a card back for hidden cards and a deterministic placeholder for unavailable IDs.

## Cache behavior

Use snapshot/provider-aware Cache Storage keys, deduplicate concurrent requests, validate manifest digest/length/content/dimensions/decode before persistence, evict invalid cache entries, tolerate provider outages with placeholders, and keep verified blobs separate from mounted object-URL leases. Network/decode work is bounded by byte, concurrency, cancellation, and timeout limits. Hidden identities never trigger image lookup or URL creation.

Technical availability is not permission to redistribute; see [`../07-governance/licensing-and-distribution.md`](../07-governance/licensing-and-distribution.md).
