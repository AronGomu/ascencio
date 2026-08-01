import { describe, expect, it, vi } from "vitest";
import type { OcgCoreSync } from "../../vendor/ocgcore-wasm/0.1.2/dist/index.js";
import {
  OcgCoreAdapter,
  vendoredMessageTypes,
  type CoreFactory,
  type EngineCardQuery,
  type EngineDuelHandle,
  type EngineLocationQuery,
} from "../../src/worker/engine/OcgCoreAdapter.ts";
import {
  EngineMessageType,
  EngineQueryFlag,
  EngineResponseType,
} from "../../src/worker/engine/engine-constants.ts";

function fakeCore(version: readonly [number, number]): OcgCoreSync {
  return { getVersion: () => version } as OcgCoreSync;
}

describe("OcgCoreAdapter", () => {
  it("initializes only the synchronous factory and validates the version", async () => {
    const factory = vi.fn<CoreFactory>().mockResolvedValue(fakeCore([11, 0]));
    const adapter = await OcgCoreAdapter.initialize({
      wasmBinary: new ArrayBuffer(8),
      factory,
    });

    expect(adapter.getVersion()).toEqual([11, 0]);
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({ sync: true }),
    );
  });

  it("preserves raw overlay location bits and ordinal from parsed MOVE", async () => {
    const move = {
      type: 50,
      card: 5053103,
      from: {
        controller: 0,
        location: 16,
        sequence: 0,
        position: 1,
      },
      to: {
        controller: 0,
        location: 132,
        sequence: 0,
        position: 1,
        overlay_sequence: 2,
      },
    };
    const core = {
      getVersion: () => [11, 0] as const,
      duelGetMessage: () => [move],
    } as unknown as OcgCoreSync;
    const adapter = await OcgCoreAdapter.initialize({
      wasmBinary: new ArrayBuffer(8),
      factory: async () => core,
    });

    expect(adapter.getMessages({} as EngineDuelHandle)).toEqual([move]);
  });

  it("pins counter messages, query flag, and rich chain records to the vendored wrapper", async () => {
    expect(EngineMessageType.ADD_COUNTER).toBe(101);
    expect(EngineMessageType.REMOVE_COUNTER).toBe(102);
    expect(EngineQueryFlag.COUNTERS).toBe(0x20000);
    expect(vendoredMessageTypes()).toEqual(
      expect.arrayContaining([
        EngineMessageType.ADD_COUNTER,
        EngineMessageType.REMOVE_COUNTER,
      ]),
    );
    const records = [
      {
        type: EngineMessageType.ADD_COUNTER,
        counter_type: 0xffff,
        controller: 1,
        location: 4,
        sequence: 6,
        count: 0xffff,
      },
      {
        type: EngineMessageType.REMOVE_COUNTER,
        counter_type: 1,
        controller: 0,
        location: 8,
        sequence: 4,
        count: 2,
      },
      {
        type: EngineMessageType.CHAINING,
        code: 97590747,
        controller: 0,
        location: 132,
        sequence: 1,
        position: 1,
        overlay_sequence: 2,
        triggering_controller: 1,
        triggering_location: 2,
        triggering_sequence: 3,
        description: 102n,
        chain_size: 1,
      },
    ];
    const core = {
      getVersion: () => [11, 0] as const,
      duelGetMessage: () => records,
    } as unknown as OcgCoreSync;
    const adapter = await OcgCoreAdapter.initialize({
      wasmBinary: new ArrayBuffer(8),
      factory: async () => core,
    });
    expect(adapter.getMessages({} as EngineDuelHandle)).toEqual(records);
  });

  it("adds operation context to parser and encoder failures", async () => {
    const core = {
      getVersion: () => [11, 0] as const,
      duelGetMessage: () => {
        throw new Error("eof");
      },
      duelSetResponse: () => {
        throw new RangeError("offset");
      },
    } as unknown as OcgCoreSync;
    const adapter = await OcgCoreAdapter.initialize({
      wasmBinary: new ArrayBuffer(8),
      factory: async () => core,
    });
    const handle = {} as EngineDuelHandle;

    expect(() => adapter.getMessages(handle)).toThrow(
      "Unable to parse core message batch: eof",
    );
    expect(() =>
      adapter.setResponse(handle, {
        type: EngineResponseType.SELECT_YES_NO,
        yes: true,
      }),
    ).toThrow("Unable to encode core response type 3: offset");
  });

  it("wraps card and location query failures with operation context", async () => {
    const cardQuery = vi.fn(() => ({ overlayCards: [1, 2] }));
    const locationQuery = vi.fn(() => [{ code: 1 }]);
    const core = {
      getVersion: () => [11, 0] as const,
      duelQuery: cardQuery,
      duelQueryLocation: locationQuery,
    } as unknown as OcgCoreSync;
    const adapter = await OcgCoreAdapter.initialize({
      wasmBinary: new ArrayBuffer(8),
      factory: async () => core,
    });
    const handle = {} as EngineDuelHandle;
    const cardRequest: EngineCardQuery = {
      flags: 1,
      controller: 0 as const,
      location: 4 as EngineCardQuery["location"],
      sequence: 0,
      overlaySequence: 0,
    };
    const locationRequest: EngineLocationQuery = {
      flags: 1,
      controller: 0 as const,
      location: 64 as EngineLocationQuery["location"],
    };

    expect(adapter.queryCard(handle, cardRequest)).toEqual({
      overlayCards: [1, 2],
    });
    expect(adapter.queryLocation(handle, locationRequest)).toEqual([
      { code: 1 },
    ]);
    expect(cardQuery).toHaveBeenCalledWith(handle, cardRequest);
    expect(locationQuery).toHaveBeenCalledWith(handle, locationRequest);

    cardQuery.mockImplementation(() => {
      throw new Error("bad card query");
    });
    expect(() => adapter.queryCard(handle, cardRequest)).toThrow(
      "Unable to query core card: bad card query",
    );
    locationQuery.mockImplementation(() => {
      throw new Error("bad location query");
    });
    expect(() => adapter.queryLocation(handle, locationRequest)).toThrow(
      "Unable to query core location: bad location query",
    );
  });

  it("reports a bounded structured initialization failure", async () => {
    const factory: CoreFactory = () => new Promise(() => undefined);
    await expect(
      OcgCoreAdapter.initialize({
        wasmBinary: new ArrayBuffer(8),
        timeoutMs: 5,
        factory,
      }),
    ).rejects.toMatchObject({
      duelError: { code: "engine_initialization_failed" },
    });
  });
});
