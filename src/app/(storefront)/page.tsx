"use client";

import Image from "@/components/safe-image";
import Link from "next/link";
import { BannerLink } from "@/components/storefront/banner-link";
import { useDemo } from "@/lib/store";
import { visibleProducts } from "@/lib/catalog";
import { percentOff } from "@/lib/format";
import { toPublicProducts } from "@/lib/catalog-dto";
import { ProductCard } from "@/components/product-card";
import {
  ArrowRightIcon,
  CartIcon,
  ChevronRightIcon,
  HeadsetIcon,
  SearchIcon,
} from "@/components/icons";

const steps = [
  ["01", "Explore", "Browse products across trusted categories."],
  ["02", "Place your order", "Checkout once through the Paydan storefront."],
  [
    "03",
    "We coordinate",
    "Our team handles supplier relationships behind the scenes.",
  ],
  ["04", "Follow progress", "Track clear milestones from order to delivery."],
];

export default function HomePage() {
  const { state } = useDemo();

  const products = visibleProducts(state.products);
  const rankedBanners = [...state.banners].sort(
    (left, right) => (right.priority ?? 0) - (left.priority ?? 0),
  );
  const hero = rankedBanners.find(
    (banner) => banner.active && banner.placement === "hero",
  );
  const sideBanners = rankedBanners
    .filter((banner) => banner.active && banner.placement === "side")
    .slice(0, 2);
  const signedIn = Boolean(state.customerSession);

  /**
   * The homepage ships price-free DTOs regardless of session: its listings show
   * no money to anyone, so only the sign-in-aware CTA differs.
   */
  const catalogue = toPublicProducts(products);

  const techPicks = catalogue
    .filter(
      (product) =>
        product.featured &&
        ["phones-and-tablets", "gaming", "appliances"].includes(
          product.categorySlug,
        ),
    )
    .slice(0, 4);
  const favourites = catalogue
    .filter((product) => product.featured)
    .slice(0, 5);
  const newArrivals = catalogue
    .filter((product) => product.newArrival)
    .slice(0, 5);
  const trending = catalogue
    .filter((product) => product.featured || product.newArrival)
    .slice(0, 8);
  const homeDepartments = [...state.categories]
    .filter((category) => category.homepageVisible !== false)
    .sort(
      (left, right) =>
        (left.homepageOrder ?? left.order) -
        (right.homepageOrder ?? right.order),
    )
    .slice(0, 12);
  const departmentCount = state.categories.length;
  const bestSaving = products.reduce((best, product) => {
    const off = percentOff(product.price, product.compareAt) ?? 0;
    return off > best ? off : best;
  }, 0);

  return (
    <>
      <div className="wrap">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-main">
            {hero ? (
              <Image
                src={hero.image}
                alt={hero.altText ?? ""}
                fill
                priority
                sizes="(max-width: 900px) 100vw, 68vw"
              />
            ) : null}
            <div className="hero-overlay" />
            <div className="hero-copy">
              <span className="kicker">
                {hero?.eyebrow ?? "THE PAYDAN EDIT"}
              </span>
              <h1 id="hero-title">
                {hero?.title ?? "Everything you need, sourced with care."}
              </h1>
              <p>
                {hero?.subtitle ??
                  "Shop everyday essentials, standout technology and fresh finds — all through one trusted storefront."}
              </p>
              {hero ? (
                <BannerLink
                  className="primary-button"
                  href={hero.href}
                  bannerId={hero.id}
                >
                  {hero.ctaLabel}
                  <ArrowRightIcon />
                </BannerLink>
              ) : (
                <Link className="primary-button" href="/shop">
                  Explore the collection
                  <ArrowRightIcon />
                </Link>
              )}
            </div>
          </div>

          <div className="hero-side">
            {sideBanners.length
              ? sideBanners.map((banner, index) => (
                  <article
                    className={`promo ${index ? "promo-source" : "promo-tech"}`}
                    key={banner.id}
                    style={
                      banner.image
                        ? {
                            backgroundImage: `linear-gradient(145deg, rgba(233,241,235,.92), rgba(200,222,208,.78)), url(${banner.image})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  >
                    <span>{banner.eyebrow}</span>
                    <h2>{banner.title}</h2>
                    <BannerLink href={banner.href} bannerId={banner.id}>
                      {banner.ctaLabel}
                      <ArrowRightIcon />
                    </BannerLink>
                  </article>
                ))
              : [
                  <article className="promo promo-tech" key="technology">
                    <span>TECH REFRESH</span>
                    <h2>Better tools for everyday life.</h2>
                    <Link href="/category/phones-and-tablets">
                      Shop technology
                      <ArrowRightIcon />
                    </Link>
                  </article>,
                  <article className="promo promo-source" key="sourcing">
                    <span>PAYDAN SOURCING</span>
                    <h2>Can&rsquo;t find it? We&rsquo;ll help source it.</h2>
                    <Link href="/request-product">
                      Make a request
                      <ArrowRightIcon />
                    </Link>
                  </article>,
                ]}
          </div>
        </section>
      </div>

      <section className="section department-section">
        <div className="wrap">
          <div className="section-heading">
            <div>
              <span className="kicker green">SHOP YOUR WAY</span>
              <h2>Explore departments</h2>
            </div>
            <Link href="/categories">
              View all categories
              <ArrowRightIcon />
            </Link>
          </div>

          <div className="category-grid">
            {homeDepartments.map((department, index) => (
              <Link
                className="category-card"
                key={department.slug}
                href={`/category/${department.slug}`}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{department.name}</h3>
                  <p>{department.shortDescription || department.description}</p>
                </div>
                <ChevronRightIcon />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="market-feature wrap" id="tech">
        <article className="editorial">
          <div>
            <span className="kicker">TECHNOLOGY &amp; GADGETS</span>
            <h2>
              Power your
              <br />
              next move.
            </h2>
            <p>
              Smart devices and practical tools selected for how you live and
              work.
            </p>
            <Link href="/shop">
              Explore technology
              <ArrowRightIcon />
            </Link>
          </div>
        </article>

        <div className="feature-products">
          {techPicks.map((product) => (
            <ProductCard key={product.id} product={product} showPrice={false} />
          ))}
        </div>
      </section>

      <section className="section wrap" id="favorites">
        <div className="section-heading">
          <div>
            <span className="kicker green">SHOPPERS ARE LOVING</span>
            <h2>Customer favourites</h2>
          </div>
          <Link href="/shop">
            View best sellers
            <ArrowRightIcon />
          </Link>
        </div>
        <div className="product-grid">
          {favourites.map((product) => (
            <ProductCard key={product.id} product={product} showPrice={false} />
          ))}
        </div>
      </section>

      <section className="department-stories wrap">
        <Link href="/category/health-and-beauty" className="story beauty">
          <span>BEAUTY &amp; PERSONAL CARE</span>
          <h2>
            Small rituals,
            <br />
            big difference.
          </h2>
          <small>Shop the beauty edit →</small>
        </Link>
        <Link href="/category/home-and-living" className="story home">
          <span>HOME &amp; LIVING</span>
          <h2>
            Make space for
            <br />
            better living.
          </h2>
          <small>Explore the home edit →</small>
        </Link>
        <Link href="/category/supermarket" className="story grocery">
          <span>GROCERY &amp; EATERY</span>
          <h2>
            Everyday favourites,
            <br />
            all in one place.
          </h2>
          <small>Browse essentials →</small>
        </Link>
      </section>

      <section className="section wrap" id="new">
        <div className="section-heading">
          <div>
            <span className="kicker green">FRESH ON PAYDAN</span>
            <h2>New arrivals</h2>
          </div>
          <Link href="/new-arrivals">
            Explore what&rsquo;s new
            <ArrowRightIcon />
          </Link>
        </div>
        <div className="product-grid">
          {newArrivals.map((product) => (
            <ProductCard key={product.id} product={product} showPrice={false} />
          ))}
        </div>
      </section>

      <section className="section products-section wrap" id="products">
        <div className="section-heading">
          <div>
            <span className="kicker green">CURATED FOR YOU</span>
            <h2>Trending now</h2>
          </div>
          <Link href="/shop">
            See the full catalogue
            <ArrowRightIcon />
          </Link>
        </div>

        {products.length ? (
          <div className="product-grid">
            {trending.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                showPrice={false}
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <SearchIcon />
            <h3>No exact matches yet</h3>
            <p>
              Try a broader search, or ask Paydan to source the product for you.
            </p>
            <Link href="/request-product">Request this product</Link>
          </div>
        )}
      </section>

      <section className="deal-band" id="deals">
        <div className="wrap deal-inner">
          <div>
            <span className="kicker">THE WEEKEND LIST</span>
            <h2>
              Good finds.
              <br />
              Better value.
            </h2>
            <p>
              Explore selected offers across tech, personal care, and everyday
              essentials.
            </p>
            <Link className="dark-button" href="/deals">
              Shop selected deals
              <ArrowRightIcon />
            </Link>
          </div>
          <div className="deal-stat">
            {signedIn ? (
              <>
                <span>UP TO</span>
                <strong>{bestSaving}%</strong>
                <p>off selected products</p>
              </>
            ) : (
              <>
                <span>OVER</span>
                <strong>{catalogue.length}</strong>
                <p>products across {departmentCount} departments</p>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="wrap">
        <section className="section how" id="how">
          <div className="section-heading">
            <div>
              <span className="kicker green">ONE CART, SIMPLIFIED</span>
              <h2>How Paydan works</h2>
            </div>
          </div>

          <div className="steps">
            {steps.map(([number, title, body]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="business" id="business">
          <div>
            <span className="kicker">PAYDAN FOR BUSINESS</span>
            <h2>
              Buying for a team,
              <br />
              project or workplace?
            </h2>
            <p>
              Submit a multi-item request and let our procurement team
              coordinate the sourcing process. Quotes and availability are
              confirmed before purchase.
            </p>
            <Link href="/request-product">
              Start a bulk request
              <ArrowRightIcon />
            </Link>
          </div>
          <div className="business-metric">
            <span>ONE REQUEST</span>
            <strong>
              Many items.
              <br />
              One coordinated quote.
            </strong>
            <small>Designed for offices, projects and growing teams</small>
          </div>
        </section>

        <section className="source" id="source">
          <div className="source-copy">
            <span className="kicker">PERSONAL SOURCING</span>
            <h2>
              If it exists,
              <br />
              let&rsquo;s find it.
            </h2>
            <p>
              Tell us what you need, your preferred budget and where it needs to
              go. Our team will review your request and share a no-obligation
              quote.
            </p>
            <Link className="source-action" href="/request-product">
              Start a product request
              <ArrowRightIcon />
            </Link>
          </div>
          <div className="source-visual" aria-hidden="true">
            <div className="orbit" />
            <div className="source-note">
              <span>Request received</span>
              <strong>We&rsquo;ll review the details</strong>
              <small>Reviewed by our sourcing team</small>
            </div>
          </div>
        </section>

        <section className="support" id="support">
          <article>
            <CartIcon />
            <div>
              <h3>One Paydan checkout</h3>
              <p>A single cart, even when suppliers differ.</p>
            </div>
          </article>
          <article>
            <HeadsetIcon />
            <div>
              <h3>Human support</h3>
              <p>Clear help throughout your order journey.</p>
            </div>
          </article>
          <article>
            <SearchIcon />
            <div>
              <h3>Sourcing assistance</h3>
              <p>Request products beyond the listed catalogue.</p>
            </div>
          </article>
        </section>
      </div>
    </>
  );
}
