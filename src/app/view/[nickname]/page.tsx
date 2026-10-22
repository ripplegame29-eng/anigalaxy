import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ProfileView } from "@/components/ProfileView";
import { ViewShell } from "@/components/profile/ViewShell";
import { dbAvailable, getDb } from "@/lib/server/db";
import { buildProfileView } from "@/lib/server/profile-view";
import { SESSION_COOKIE, sessionUser } from "@/lib/server/users";
import { VIEW_FLAG } from "@/lib/view-mode";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Профиль игрока · AniGalaxy", robots: { index: false, follow: false } };

/** JSON в <script>: экранируем всё, что могло бы закрыть тег или сломать строку */
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);
const safeJson = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .split(LINE_SEP)
    .join("\\u2028")
    .split(PARA_SEP)
    .join("\\u2029");

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 text-muted">{text}</p>
    </div>
  );
}

/**
 * Чужой профиль — `/u/<ник>`: тот же ProfileView в гостевом режиме, но с
 * настоящими данными игрока. Сервер кладёт их в HTML отдельным скриптом,
 * который подменяет localStorage страницы до запуска приложения; личное
 * (баланс, подарки, чёрный список) вырезано на сервере, а закрытые
 * профили не отдаются совсем.
 */
export default async function ViewDocumentPage({ params }: { params: Promise<{ nickname: string }> }) {
  const { nickname } = await params;
  const decoded = decodeURIComponent(nickname);
  if (decoded.toLowerCase() === "me") return <Message title="Профиль" text="Откройте профиль игрока из рейтинга." />;

  if (!dbAvailable()) return <Message title={decoded} text="Сервер временно недоступен. Попробуйте позже." />;
  const db = getDb();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const viewer = sessionUser(db, token);
  if (viewer && viewer.nickname.toLowerCase() === decoded.toLowerCase()) return <Message title={viewer.nickname} text="Это ваш профиль." />;

  const view = buildProfileView(db, decoded, viewer?.id ?? null);
  if (!view.ok) {
    return view.reason === "closed" ? (
      <Message title={view.nickname} text="Профиль закрыт владельцем." />
    ) : (
      <Message title={decoded} text="Игрок с таким ником не найден." />
    );
  }

  const shim = `(function(){try{var d=${safeJson(view.data)},m=Object.create(null),k;for(k in d)m[k]=d[k];
var P=Storage.prototype,g=P.getItem,s=P.setItem,r=P.removeItem,c=P.clear,y=P.key,L=Object.getOwnPropertyDescriptor(P,'length');
var own=function(o){return o===window.localStorage};
P.getItem=function(x){return own(this)?(x in m?m[x]:null):g.call(this,x)};
P.setItem=function(x,v){if(own(this)){m[x]=String(v)}else{s.call(this,x,v)}};
P.removeItem=function(x){if(own(this)){delete m[x]}else{r.call(this,x)}};
P.clear=function(){if(own(this)){for(var z in m)delete m[z]}else{c.call(this)}};
P.key=function(i){return own(this)?(Object.keys(m)[i]||null):y.call(this,i)};
if(L&&L.get){Object.defineProperty(P,'length',{configurable:true,get:function(){return own(this)?Object.keys(m).length:L.get.call(this)}})}
window.${VIEW_FLAG}=${safeJson(view.nickname)};document.documentElement.setAttribute('data-ag-view','1')}catch(e){}})();`;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: shim }} />
      <ViewShell nickname={view.nickname}>
        <Suspense fallback={null}>
          <ProfileView mode="guest" basePath={`/view/${encodeURIComponent(view.nickname)}`} />
        </Suspense>
      </ViewShell>
    </>
  );
}
