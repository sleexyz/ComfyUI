"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WebsocketDemo } from "@/components/WebsocketDemo";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between mt-10">
      <Tabs defaultValue="ws" className="w-full max-w-[600px]">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ws">Realtime</TabsTrigger>
        </TabsList>
        <TabsContent value="ws">
          <WebsocketDemo />
        </TabsContent>
      </Tabs>
    </main>
  );
}