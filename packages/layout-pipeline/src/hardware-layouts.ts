// layout-pipeline/src/hardware-layouts.ts - Central hardware layout registry and options.
import aliceArisu from './data/hardware/alice-arisu.json';
import appleMacbookAnsi from './data/hardware/apple-macbook-ansi.json';
import appleMacbookIso from './data/hardware/apple-macbook-iso.json';
import appleMacbookJis from './data/hardware/apple-macbook-jis.json';
import appleMacbookZhPinyin from './data/hardware/apple-macbook-zh-pinyin.json';
import appleMacbookZhZhuyin from './data/hardware/apple-macbook-zh-zhuyin.json';
import ansi60 from './data/hardware/ansi-60.json';
import ansi75 from './data/hardware/ansi-75.json';
import ansiFull from './data/hardware/ansi-full.json';
import ansiTkl from './data/hardware/ansi-tkl.json';
import hhkb from './data/hardware/hhkb.json';
import iso60 from './data/hardware/iso-60.json';
import iso75 from './data/hardware/iso-75.json';
import isoFull from './data/hardware/iso-full.json';
import isoTkl from './data/hardware/iso-tkl.json';
import jis60 from './data/hardware/jis-60.json';
import jis75 from './data/hardware/jis-75.json';
import jisFull from './data/hardware/jis-full.json';
import jisTkl from './data/hardware/jis-tkl.json';

export const layouts = {
  'alice-arisu': aliceArisu,
  'apple-macbook-ansi': appleMacbookAnsi,
  'apple-macbook-iso': appleMacbookIso,
  'apple-macbook-jis': appleMacbookJis,
  'apple-macbook-zh-pinyin': appleMacbookZhPinyin,
  'apple-macbook-zh-zhuyin': appleMacbookZhZhuyin,
  'ansi-60': ansi60,
  'ansi-75': ansi75,
  'ansi-full': ansiFull,
  'ansi-tkl': ansiTkl,
  hhkb,
  'iso-60': iso60,
  'iso-75': iso75,
  'iso-full': isoFull,
  'iso-tkl': isoTkl,
  'jis-60': jis60,
  'jis-75': jis75,
  'jis-full': jisFull,
  'jis-tkl': jisTkl,
};

export type LayoutKey = keyof typeof layouts;

export const HARDWARE_LAYOUT_OPTIONS: readonly LayoutKey[] = [
  'ansi-60',
  'ansi-75',
  'ansi-tkl',
  'ansi-full',
  'iso-60',
  'iso-75',
  'iso-tkl',
  'iso-full',
  'jis-60',
  'jis-75',
  'jis-tkl',
  'jis-full',
  'apple-macbook-ansi',
  'apple-macbook-iso',
  'apple-macbook-jis',
  'apple-macbook-zh-pinyin',
  'apple-macbook-zh-zhuyin',
  'hhkb',
  'alice-arisu',
];
