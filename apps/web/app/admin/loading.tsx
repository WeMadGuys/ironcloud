import { Loader } from '@/components/Loader/Loader';

/** Content-area only — keep sidebar/top nav visible during route transitions. */
export default function AdminLoading() {
  return <Loader />;
}
