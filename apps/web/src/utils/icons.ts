import {
  mdiAccountGroup,
  mdiBike,
  mdiChartBar,
  mdiChartLine,
  mdiClipboardList,
  mdiCog,
  mdiHandshake,
  mdiHeadset,
  mdiHomeGroup,
  mdiPackageVariantClosed,
  mdiTag,
  mdiViewDashboard,
  mdiWallet,
} from '@mdi/js';

type IconPathData = string;

const ICON_MAP: Record<string, IconPathData> = {
  viewDashboard: mdiViewDashboard,
  clipboardList: mdiClipboardList,
  accountGroup: mdiAccountGroup,
  homeGroup: mdiHomeGroup,
  packageVariant: mdiPackageVariantClosed,
  handshake: mdiHandshake,
  bike: mdiBike,
  wallet: mdiWallet,
  chartLine: mdiChartLine,
  tag: mdiTag,
  chartBar: mdiChartBar,
  headset: mdiHeadset,
  cog: mdiCog,
};

export const getNavIcon = (name: string): IconPathData =>
  ICON_MAP[name] ?? mdiViewDashboard;
