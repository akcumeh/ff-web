import { styleLabel, type SuitDetail } from "@ff/shared";

export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

const OFFICES = [
  { name: "Frankie Suits, head office", street: "43 Martins Street (Brasas Plaza)", tel: "+2347081156800" },
  { name: "Frankie Suits, branch office", street: "No 35/37 Martins Street (Faith Plaza)", tel: "+2347069743721" },
];

export function storeJsonLd(site: string) {
  const sameAs = [process.env.NEXT_PUBLIC_WHATSAPP_CHANNEL_URL, process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL].filter(Boolean);
  const [head, branch] = OFFICES.map((o) => ({
    "@type": "ClothingStore",
    name: o.name,
    url: site,
    telephone: o.tel,
    email: "frankiefabrics@yahoo.com",
    foundingDate: "2012",
    address: { "@type": "PostalAddress", streetAddress: o.street, addressLocality: "Lagos Island", addressRegion: "Lagos", addressCountry: "NG" },
    ...(sameAs.length ? { sameAs } : {}),
  }));
  return { "@context": "https://schema.org", "@graph": [{ ...head, "@id": `${site}/#head-office` }, { ...branch, parentOrganization: { "@id": `${site}/#head-office` } }] };
}

export function productJsonLd(suit: SuitDetail, site: string) {
  const url = `${site}/suits/${suit.slug}`;
  const offers = suit.variants.map((v) => ({
    "@type": "Offer",
    sku: `${suit.ref}-${v.colour}-${v.size}`,
    price: (suit.price_kobo / 100).toFixed(2),
    priceCurrency: "NGN",
    availability: v.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    url,
  }));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: `${styleLabel[suit.style]} ladies' suit, Ref ${suit.ref}`,
        sku: suit.ref,
        brand: { "@type": "Brand", name: "Frankie Suits" },
        ...(suit.description ? { description: suit.description } : {}),
        ...(suit.cover ? { image: suit.cover.srcset.map((s) => s.url) } : {}),
        offers,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: site },
          { "@type": "ListItem", position: 2, name: "Gallery", item: `${site}/gallery` },
          { "@type": "ListItem", position: 3, name: `Ref ${suit.ref}`, item: url },
        ],
      },
    ],
  };
}
