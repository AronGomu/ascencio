// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import type { ComponentProps } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import CardControl from "../../src/battle/app/components/duel-field/CardControl.svelte";
import StackControl from "../../src/battle/app/components/duel-field/StackControl.svelte";
import HandZoomOverlay from "../../src/battle/app/components/duel-field/HandZoomOverlay.svelte";
import MaterialCard from "../../src/battle/app/components/duel-field/MaterialCard.svelte";
import ZoneListEntryTile from "../../src/battle/app/components/duel-field/ZoneListEntryTile.svelte";
import CardTray from "../../src/battle/app/components/duel-field/CardTray.svelte";
import MaterialSelectDialog from "../../src/battle/app/components/duel-field/MaterialSelectDialog.svelte";
import {
  createCardImageSourceLibrary,
  type CardImageLibrary,
} from "../../src/battle/app/images/card-image-cache.ts";
import type {
  CardImageLease,
  CardImageSource,
} from "../../src/cards/images/index.ts";
import {
  cardCode,
  cardInstanceId,
  choiceId,
} from "../../src/battle/duel/contracts/ids.ts";
import type { BoardCardView } from "../../src/battle/field/board-view-model.ts";

const makeCard = (code: number | null): BoardCardView => ({
  id: "test",
  targetId: "card:test",
  instanceId: cardInstanceId("test"),
  player: 0,
  owner: 0,
  zoneId: "p0:hand",
  sequence: 0,
  position: "faceUpAttack",
  orientation: "upright",
  facing: "self",
  hidden: code === null,
  label: "Card",
  x: 0,
  y: 0,
  width: 72 / 1280,
  height: 104 / 720,
  counters: [],
  materials: [],
  chainLinks: [],
  image:
    code === null ? { kind: "back" } : { kind: "face", code: cardCode(code) },
});
const codeField = (code: number | null) =>
  code === null ? {} : { code: cardCode(code) };
const fixtures: Array<{
  name: string;
  mount: (
    library: CardImageLibrary,
    code: number | null,
  ) => {
    container: HTMLElement;
    unmount: () => void;
    rerender: (library: CardImageLibrary, code: number | null) => Promise<void>;
  };
  open?: (container: HTMLElement) => Promise<void>;
}> = [
  {
    name: "CardControl",
    mount: (library, code) => {
      const props = (
        code: number | null,
        images: CardImageLibrary,
      ): ComponentProps<typeof CardControl> => ({
        ...{
          imageLibrary: images,
          cardBackUrl: "back.png",
          placeholderUrl: images.placeholderUrl,
        },
        card: makeCard(code),
        layout: "hand",
        imageUrl: "back.png",
      });
      const view = render(CardControl, { props: props(code, library) });
      return {
        container: view.container,
        unmount: view.unmount,
        rerender: (images, value) => view.rerender(props(value, images)),
      };
    },
  },
  {
    name: "HandZoomOverlay",
    mount: (library, code) => {
      const props = (
        code: number | null,
        images: CardImageLibrary,
      ): ComponentProps<typeof HandZoomOverlay> => ({
        ...{
          imageLibrary: images,
          cardBackUrl: "back.png",
          placeholderUrl: images.placeholderUrl,
        },
        card: makeCard(code),
        anchor: { left: 0, top: 0, width: 72, height: 104 },
        frameWidth: 1280,
      });
      const view = render(HandZoomOverlay, { props: props(code, library) });
      return {
        container: view.container,
        unmount: view.unmount,
        rerender: (images, value) => view.rerender(props(value, images)),
      };
    },
  },
  {
    name: "StackControl",
    mount: (library, code) => {
      const props = (
        code: number | null,
        images: CardImageLibrary,
      ): ComponentProps<typeof StackControl> => ({
        ...{
          imageLibrary: images,
          cardBackUrl: "back.png",
          placeholderUrl: images.placeholderUrl,
        },
        stack: {
          id: "p0:graveyard",
          targetId: "stack:p0:graveyard",
          player: 0,
          zone: "graveyard",
          count: 1,
          publicCount: 1,
          label: "Graveyard",
          accessibleLabel: "Your Graveyard",
          x: 0,
          y: 0,
          width: 72,
          height: 104,
          ...(code === null ? {} : { topCardCode: cardCode(code) }),
        },
        placement: { x: 0, y: 0, width: 72, height: 104 },
        cardWidth: 72,
        cardHeight: 104,
      });
      const view = render(StackControl, { props: props(code, library) });
      return {
        container: view.container,
        unmount: view.unmount,
        rerender: (images, value) => view.rerender(props(value, images)),
      };
    },
  },
  {
    name: "MaterialCard",
    mount: (library, code) => {
      const props = (
        code: number | null,
        images: CardImageLibrary,
      ): ComponentProps<typeof MaterialCard> => ({
        ...{
          imageLibrary: images,
          cardBackUrl: "back.png",
          placeholderUrl: images.placeholderUrl,
        },
        material: {
          id: "material",
          sequence: 0,
          label: "Material",
          identityVisible: code !== null,
          ...codeField(code),
        },
        index: 0,
      });
      const view = render(MaterialCard, { props: props(code, library) });
      return {
        container: view.container,
        unmount: view.unmount,
        rerender: (images, value) => view.rerender(props(value, images)),
      };
    },
  },
  {
    name: "ZoneListEntryTile",
    mount: (library, code) => {
      const props = (
        code: number | null,
        images: CardImageLibrary,
      ): ComponentProps<typeof ZoneListEntryTile> => ({
        ...{
          imageLibrary: images,
          cardBackUrl: "back.png",
          placeholderUrl: images.placeholderUrl,
        },
        entry: {
          id: "entry",
          position: 1,
          controller: 0,
          location: "graveyard",
          sequence: 0,
          identityVisible: code !== null,
          label: "Card",
          ...codeField(code),
        },
      });
      const view = render(ZoneListEntryTile, { props: props(code, library) });
      return {
        container: view.container,
        unmount: view.unmount,
        rerender: (images, value) => view.rerender(props(value, images)),
      };
    },
  },
  {
    name: "MaterialSelectDialog",
    mount: (library, code) => {
      const props = (
        code: number | null,
        images: CardImageLibrary,
      ): ComponentProps<typeof MaterialSelectDialog> => ({
        ...{
          imageLibrary: images,
          cardBackUrl: "back.png",
          placeholderUrl: images.placeholderUrl,
        },
        choices: [
          {
            id: choiceId(`material-${code}`),
            label: "Material",
            action: "select",
            cardAddress: { controller: 0, location: "monster", sequence: 0 },
            ...(code === null ? {} : { cardCode: cardCode(code) }),
          },
        ],
        minSelections: 1,
        maxSelections: 1,
        disabled: false,
        onconfirm: vi.fn(),
        oncancel: null,
      });
      const view = render(MaterialSelectDialog, {
        props: props(code, library),
      });
      return {
        container: view.container,
        unmount: view.unmount,
        rerender: (images, value) => view.rerender(props(value, images)),
      };
    },
  },
  {
    name: "CardTray",
    mount: (library, code) => {
      const props = (
        code: number | null,
        images: CardImageLibrary,
      ): ComponentProps<typeof CardTray> => ({
        ...{
          imageLibrary: images,
          cardBackUrl: "back.png",
          placeholderUrl: images.placeholderUrl,
        },
        label: "Your Graveyard",
        player: 0,
        zone: "graveyard",
        count: 1,
        cards: [
          {
            instanceId: cardInstanceId("tray"),
            owner: 0,
            controller: 0,
            location: "graveyard",
            sequence: 0,
            position: code === null ? "faceDownDefense" : "faceUpAttack",
            faceUp: code !== null,
            counters: [],
            overlayMaterials: [],
            ...codeField(code),
          },
        ],
      });
      const view = render(CardTray, { props: props(code, library) });
      return {
        container: view.container,
        unmount: view.unmount,
        rerender: (images, value) => view.rerender(props(value, images)),
      };
    },
    open: async (container) => {
      await fireEvent.click(container.querySelector("button")!);
    },
  },
];
afterEach(cleanup);

describe("mounted semantic image readiness", () => {
  for (const fixture of fixtures) {
    it(`${fixture.name} updates asynchronously and releases on code/library replacement and unmount`, async () => {
      const pending: Array<
        ReturnType<typeof Promise.withResolvers<CardImageLease | null>>
      > = [];
      const signals: AbortSignal[] = [];
      const acquire = vi.fn<CardImageSource["acquire"]>(
        (_code, _variant, signal) => {
          const item = Promise.withResolvers<CardImageLease | null>();
          pending.push(item);
          signals.push(signal);
          return item.promise;
        },
      );
      const library = await createCardImageSourceLibrary(
        { acquire },
        [1, 2],
        "a".repeat(64),
        "b".repeat(64),
      );
      const view = fixture.mount(library, 1);
      await fixture.open?.(view.container);
      expect(acquire).toHaveBeenCalledOnce();
      const first = { url: "blob:first", release: vi.fn() };
      pending[0]!.resolve(first);
      await waitFor(() =>
        expect(
          view.container.querySelector('img[src="blob:first"]'),
        ).not.toBeNull(),
      );
      await view.rerender(library, 2);
      expect(first.release).toHaveBeenCalledOnce();
      expect(signals[0]!.aborted).toBe(true);
      expect(view.container.querySelector('img[src="blob:first"]')).toBeNull();
      const second = { url: "blob:second", release: vi.fn() };
      const replacement = await createCardImageSourceLibrary(
        { acquire },
        [1, 2],
        "a".repeat(64),
        "b".repeat(64),
      );
      await view.rerender(replacement, 2);
      expect(signals[1]!.aborted).toBe(true);
      pending[1]!.resolve(second);
      const third = { url: "blob:third", release: vi.fn() };
      pending[2]!.resolve(third);
      await waitFor(() =>
        expect(
          view.container.querySelector('img[src="blob:third"]'),
        ).not.toBeNull(),
      );
      expect(second.release).toHaveBeenCalledOnce();
      expect(view.container.querySelector('img[src="blob:second"]')).toBeNull();
      await view.rerender(replacement, 1);
      expect(third.release).toHaveBeenCalledOnce();
      await view.unmount();
      expect(signals[3]!.aborted).toBe(true);
      const late = { url: "blob:unmounted", release: vi.fn() };
      pending[3]!.resolve(late);
      await waitFor(() => expect(late.release).toHaveBeenCalledOnce());
      expect(document.querySelector('img[src="blob:unmounted"]')).toBeNull();
      library.dispose();
      replacement.dispose();
    });

    it(`${fixture.name} never acquires concealed identities`, async () => {
      const acquire = vi
        .fn<CardImageSource["acquire"]>()
        .mockResolvedValue(null);
      const library = await createCardImageSourceLibrary(
        { acquire },
        [1],
        "a".repeat(64),
        "b".repeat(64),
      );
      const view = fixture.mount(library, null);
      if (fixture.name === "CardTray")
        expect(view.container.querySelector("button")).toBeNull();
      expect(acquire).not.toHaveBeenCalled();
      await view.unmount();
      library.dispose();
    });
  }
});
