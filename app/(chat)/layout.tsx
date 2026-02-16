import { DataStreamProvider } from "@/components/data-stream-provider";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Restauramos el proveedor de datos necesario para el chat
    <DataStreamProvider>
      <div className="relative flex h-dvh w-full overflow-hidden bg-background">
        {children}
      </div>
    </DataStreamProvider>
  );
}