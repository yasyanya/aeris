import { currentUser } from "@/lib/auth";
import { BottomTabs, MobileAccountBar, TopNav } from "@/components/PublicNav";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <>
      <TopNav user={user} />
      <MobileAccountBar user={user} />
      <div className="flex flex-1 flex-col pb-[68px] md:pb-0">{children}</div>
      <BottomTabs />
    </>
  );
}
