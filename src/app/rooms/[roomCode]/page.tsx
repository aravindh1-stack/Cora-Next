import { RoomWorkspace } from '@/components/RoomWorkspace';

type RoomPageProps = { params: Promise<{ roomCode: string }> };

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomCode } = await params;
  return <RoomWorkspace roomCode={roomCode.toUpperCase()} />;
}