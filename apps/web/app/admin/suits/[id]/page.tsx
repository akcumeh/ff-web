import { notFound, redirect } from "next/navigation";
import { AdminSuitDetail } from "@ff/shared";
import { adminGet } from "@/lib/admin-api";
import { serverEnv } from "@/lib/server-env";
import { AdminNav } from "../../AdminNav";
import { SuitEditor } from "./SuitEditor";
import { ChannelStatus, type Post } from "./ChannelStatus";
import { z } from "zod";
import styles from "../../admin.module.css";

const PostList = z.object({ items: z.array(z.object({ id: z.uuid(), platform: z.enum(["telegram", "whatsapp_pack"]), status: z.enum(["pending", "posted", "failed"]), error: z.string().nullable() })) });

export const dynamic = "force-dynamic";

const STATUS_LABEL = { draft: "Draft", review: "Review", published: "On the site", archived: "Taken down" } as const;

export default async function EditSuitPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    const [result, posts] = await Promise.all([adminGet(`/suits/${id}`, AdminSuitDetail), adminGet(`/posts?suit_id=${id}`, PostList)]);
    const postItems: Post[] = posts.kind === "ok" ? posts.data.items : [];
    if (result.kind === "error" && result.status === 401) redirect("/admin/login");
    if (result.kind === "error" && result.status === 404) notFound();

    return (
        <main id="main" className={styles.page}>
            <AdminNav />
            {result.kind === "ok" ? (
                <>
                    <h1 className={styles.title}>{result.data.ref}: {result.data.title}</h1>
                    <p className={styles.lead}>
                        <span className={styles.status}>{STATUS_LABEL[result.data.status]}</span>
                        {result.data.batch_label ? ` ${result.data.batch_label}` : ""}
                    </p>
                    <ChannelStatus posts={postItems} />
                    <SuitEditor key={result.data.id} suit={result.data} siteUrl={serverEnv().NEXT_PUBLIC_SITE_URL} />
                </>
            ) : (
                <p className={styles.error}>{result.kind === "offline" ? "The site is having a problem right now. Please wait a few minutes and refresh the page." : result.message}</p>
            )}
        </main>
    );
}
