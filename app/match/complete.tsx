import { Redirect, useLocalSearchParams } from 'expo-router';

/** @deprecated Utiliser /match/stats */
export default function CompleteMatchRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/match/stats', params: { id: id ?? '' } }} />;
}
