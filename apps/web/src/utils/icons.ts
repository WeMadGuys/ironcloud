import {
  mdiAccountGroup,
  mdiBike,
  mdiChartBar,
  mdiChartLine,
  mdiClipboardList,
  mdiCog,
  mdiHandshake,
  mdiHomeGroup,
  mdiTag,
  mdiViewDashboard,
  mdiWallet,
  type IconPathData,
} from '@mdi/js';

const ICON_MAP: Record<string, IconPathData> = {
  viewDashboard: mdiViewDashboard,
  clipboardList: mdiClipboardList,
  accountGroup: mdiAccountGroup,
  homeGroup: mdiHomeGroup,
  handshake: mdiHandshake,
  bike: mdiBike,
  wallet: mdiWallet,
  chartLine: mdiChartLine,
  tag: mdiTag,
  chartBar: mdiChartBar,
  cog: mdiCog,
};

export const getNavIcon = (name: string): IconPathData =>
  ICON_MAP[name] ?? mdiViewDashboard;
