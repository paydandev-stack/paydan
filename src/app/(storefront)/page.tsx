"use client";

import Image from "@/components/safe-image";
import Link from "next/link";
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

const homeDepartments = [
  {
    slug: "supermarket",
    number: "01",
    name: "Supermarket",
    copy: "Everyday pantry essentials",
  },
  {
    slug: "phones-and-tablets",
    number: "02",
    name: "Phones & Tablets",
    copy: "Devices and accessories",
  },
  {
    slug: "village-market",
    number: "03",
    name: "Village Market",
    copy: "Locally sourced market staples",
  },
  {
    slug: "health-and-beauty",
    number: "04",
    name: "Health & Beauty",
    copy: "Care for every routine",
  },
  {
    slug: "fashion",
    number: "05",
    name: "Fashion",
    copy: "Fresh everyday style",
  },
  {
    slug: "food-and-eatery",
    number: "06",
    name: "Food & Eatery",
    copy: "Meals worth sharing",
  },
  {
    slug: "adult-toys",
    number: "07",
    name: "Adult Toys",
    copy: "Private, age-restricted shopping",
    adult: true,
  },
  {
    slug: "gaming",
    number: "08",
    name: "Gaming",
    copy: "Consoles and accessories",
  },
  {
    slug: "appliances",
    number: "09",
    name: "Appliances",
    copy: "Make home life easier",
  },
  {
    slug: "fuel-and-energy",
    number: "10",
    name: "Fuel & Energy",
    copy: "Energy products and accessories",
  },
  {
    slug: "shoes-and-bags",
    number: "11",
    name: "Shoes & Bags",
    copy: "Finish every look",
  },
  {
    slug: "automotive-and-fuel",
    number: "12",
    name: "Automotive",
    copy: "Tools and accessories",
  },
];
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
  const hero = state.banners.find(
    (banner) => banner.active && banner.placement === "hero",
  );
  const signedIn = Boolean(state.customerSession);

  /**
   * The homepage ships price-free DTOs regardless of session: its listings show
   * no money to anyone, so only the sign-in-aware CTA differs.
   */
  const catalogue = toPublicProducts(products);

  const techPicks = catalogue
    .filter((product) =>
      ["phones-and-tablets", "gaming", "appliances"].includes(
        product.categorySlug,
      ),
    )
    .slice(0, 4);
  const favourites = [...catalogue].reverse().slice(0, 5);
  const newArrivals = catalogue.slice(2, 7);
  const trending = catalogue.slice(0, 8);
  const departmentCount = state.categories.filter(
    (category) => !category.restricted,
  ).length;
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
                alt=""
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
              <Link className="primary-button" href="/shop">
                {hero?.ctaLabel ?? "Explore the collection"}
                <ArrowRightIcon />
              </Link>
            </div>
          </div>

          <div className="hero-side">
            <article className="promo promo-tech">
              <span>TECH REFRESH</span>
              <h2>Better tools for everyday life.</h2>
              <Link href="/category/phones-and-tablets">
                Shop technology
                <ArrowRightIcon />
              </Link>
            </article>
            <article className="promo promo-source">
              <span>PAYDAN SOURCING</span>
              <h2>Can&rsquo;t find it? We&rsquo;ll help source it.</h2>
              <Link href="/request-product">
                Make a request
                <ArrowRightIcon />
              </Link>
            </article>
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
            {homeDepartments.map((department) => (
              <Link
                className={`category-card${department.adult ? " restricted" : ""}`}
                key={department.slug}
                href={`/category/${department.slug}`}
              >
                <span>{department.number}</span>
                <div>
                  <h3>{department.name}</h3>
                  <p>{department.copy}</p>
                  {department.adult ? <small>18+ restricted</small> : null}
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
