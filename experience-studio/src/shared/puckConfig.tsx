import type { Config } from "@puckeditor/core";
import React from "react";

type LinkItem = {
  label?: string;
  href?: string;
  description?: string;
};

type ImageItem = {
  url?: string;
  alt?: string;
};

type AgendaItem = {
  text?: string;
};

const safeHref = (href?: string) => {
  const value = String(href || "").trim();
  if (!value) return "#";
  if (
    value.startsWith("/") ||
    value.startsWith("#") ||
    value.startsWith("mailto:") ||
    value.startsWith("https://") ||
    value.startsWith("http://")
  ) {
    return value;
  }
  return "#";
};

const paragraphLines = (text?: string) =>
  String(text || "")
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);

const asArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

function SectionHeader(props: { eyebrow?: string; title?: string; body?: string }) {
  return (
    <div className="xp-section-header">
      {props.eyebrow ? <span className="xp-eyebrow">{props.eyebrow}</span> : null}
      {props.title ? <h2>{props.title}</h2> : null}
      {props.body ? <p>{props.body}</p> : null}
    </div>
  );
}

function Arrow() {
  return <span aria-hidden="true" className="xp-arrow">-&gt;</span>;
}

const linkArrayField = {
  type: "array",
  arrayFields: {
    label: { type: "text" },
    href: { type: "text" },
    description: { type: "textarea" },
  },
  defaultItemProps: { label: "New link", href: "#", description: "" },
  getItemSummary: (item: LinkItem) => item.label || "Link",
} as const;

const imageArrayField = {
  type: "array",
  arrayFields: {
    url: { type: "text" },
    alt: { type: "text" },
  },
  defaultItemProps: { url: "/Components/images/image-placeholder.svg", alt: "Image" },
  getItemSummary: (item: ImageItem) => item.alt || item.url || "Image",
} as const;

const agendaArrayField = {
  type: "array",
  arrayFields: {
    text: { type: "textarea" },
  },
  defaultItemProps: { text: "New agenda item" },
  getItemSummary: (item: AgendaItem, index?: number) =>
    item.text ? `${(index || 0) + 1}. ${item.text.slice(0, 40)}` : "Agenda item",
} as const;

export const experiencePuckConfig: Config = {
  root: {
    fields: {
      title: { type: "text" },
    },
    render: ({ children }: { children: React.ReactNode }) => <main className="xp-page">{children}</main>,
  },
  categories: {
    content: {
      title: "Landing Content",
      components: [
        "AnnouncementBanner",
        "HeroBlock",
        "GalleryBlock",
        "QuickLinksBlock",
        "RichTextBlock",
        "ImageFeatureBlock",
        "ResearchAgendaBlock",
        "CtaBlock",
        "FooterLinksBlock",
      ],
      defaultExpanded: true,
    },
    login: {
      title: "Login",
      components: ["LoginShellBlock", "BrandPanelBlock", "HelpPanelBlock"],
      defaultExpanded: true,
    },
  },
  components: {
    AnnouncementBanner: {
      label: "Announcement Banner",
      fields: {
        id: { type: "text" },
        tone: {
          type: "select",
          options: [
            { label: "Green", value: "green" },
            { label: "Gold", value: "gold" },
            { label: "Neutral", value: "neutral" },
          ],
        },
        text: { type: "textarea" },
        href: { type: "text" },
        linkLabel: { type: "text" },
      },
      defaultProps: {
        id: "announcement",
        tone: "green",
        text: "New research updates are available.",
        href: "/news.html",
        linkLabel: "Read updates",
      },
      render: ({ id, tone, text, href, linkLabel }) => (
        <section id={id} className={`xp-announcement is-${tone || "green"}`}>
          <span>{text}</span>
          {linkLabel ? <a href={safeHref(href)}>{linkLabel}<Arrow /></a> : null}
        </section>
      ),
    },
    HeroBlock: {
      label: "Hero",
      fields: {
        id: { type: "text" },
        eyebrow: { type: "text" },
        title: { type: "textarea" },
        body: { type: "textarea" },
        logoUrl: { type: "text" },
        images: imageArrayField,
        primaryLabel: { type: "text" },
        primaryHref: { type: "text" },
        secondaryLabel: { type: "text" },
        secondaryHref: { type: "text" },
        variant: {
          type: "select",
          options: [
            { label: "Split Gallery", value: "split-gallery" },
            { label: "Editorial", value: "editorial" },
            { label: "Compact", value: "compact" },
          ],
        },
      },
      defaultProps: {
        id: "hero",
        eyebrow: "St. Paul University Dumaguete",
        title: "Welcome to PeAS",
        body: "A configurable research and publications portal.",
        logoUrl: "/Components/images/peas.png",
        images: [{ url: "/Components/images/1.jpg", alt: "Research photo" }],
        primaryLabel: "Explore",
        primaryHref: "#research-agenda",
        secondaryLabel: "Contact",
        secondaryHref: "/contact.html",
        variant: "split-gallery",
      },
      render: ({ id, eyebrow, title, body, logoUrl, images, primaryLabel, primaryHref, secondaryLabel, secondaryHref, variant }) => {
        const safeImages = asArray<ImageItem>(images);
        return (
          <section id={id} className={`xp-hero xp-hero-${variant || "split-gallery"}`}>
            <div className="xp-hero-media" aria-label="Featured images">
              {safeImages.slice(0, 4).map((image, index) => (
                <img key={`${image.url}-${index}`} src={image.url} alt={image.alt || ""} />
              ))}
            </div>
            <div className="xp-hero-copy">
              {logoUrl ? <img className="xp-hero-logo" src={logoUrl} alt="" /> : null}
              {eyebrow ? <span className="xp-eyebrow">{eyebrow}</span> : null}
              <h1>{title}</h1>
              <p>{body}</p>
              <div className="xp-actions">
                {primaryLabel ? <a className="xp-button-primary" href={safeHref(primaryHref)}>{primaryLabel}</a> : null}
                {secondaryLabel ? <a className="xp-button-secondary" href={safeHref(secondaryHref)}>{secondaryLabel}</a> : null}
              </div>
            </div>
          </section>
        );
      },
    },
    GalleryBlock: {
      label: "Gallery",
      fields: {
        id: { type: "text" },
        eyebrow: { type: "text" },
        title: { type: "text" },
        body: { type: "textarea" },
        images: imageArrayField,
      },
      defaultProps: {
        id: "gallery",
        eyebrow: "Highlights",
        title: "Research in motion",
        body: "A visual snapshot of the office's work.",
        images: [{ url: "/Components/images/1.jpg", alt: "Research photo" }],
      },
      render: ({ id, eyebrow, title, body, images }) => (
        <section id={id} className="xp-section">
          <SectionHeader eyebrow={eyebrow} title={title} body={body} />
          <div className="xp-gallery">
            {asArray<ImageItem>(images).map((image, index) => (
              <img key={`${image.url}-${index}`} src={image.url} alt={image.alt || ""} />
            ))}
          </div>
        </section>
      ),
    },
    QuickLinksBlock: {
      label: "Quick Links",
      fields: {
        id: { type: "text" },
        title: { type: "text" },
        links: linkArrayField,
      },
      defaultProps: {
        id: "quick-links",
        title: "Explore",
        links: [{ label: "Research Agenda", href: "#research-agenda", description: "Explore focus areas." }],
      },
      render: ({ id, title, links }) => (
        <section id={id} className="xp-section xp-quick-links">
          {title ? <h2>{title}</h2> : null}
          <div className="xp-card-grid">
            {asArray<LinkItem>(links).map((link, index) => (
              <a key={`${link.label}-${index}`} className="xp-link-card" href={safeHref(link.href)}>
                <strong>{link.label}</strong>
                <span>{link.description}</span>
                <Arrow />
              </a>
            ))}
          </div>
        </section>
      ),
    },
    RichTextBlock: {
      label: "Rich Text",
      fields: {
        id: { type: "text" },
        eyebrow: { type: "text" },
        title: { type: "text" },
        body: { type: "textarea" },
      },
      defaultProps: {
        id: "rich-text",
        eyebrow: "About",
        title: "Section title",
        body: "Write section copy here.",
      },
      render: ({ id, eyebrow, title, body }) => (
        <section id={id} className="xp-section">
          <SectionHeader eyebrow={eyebrow} title={title} />
          <div className="xp-prose">
            {paragraphLines(body).map((line) => <p key={line}>{line}</p>)}
          </div>
        </section>
      ),
    },
    ImageFeatureBlock: {
      label: "Image Feature",
      fields: {
        id: { type: "text" },
        eyebrow: { type: "text" },
        title: { type: "text" },
        body: { type: "textarea" },
        imageUrl: { type: "text" },
        imageAlt: { type: "text" },
        caption: { type: "text" },
      },
      defaultProps: {
        id: "image-feature",
        eyebrow: "Feature",
        title: "Image feature",
        body: "Describe this image.",
        imageUrl: "/Components/images/image-placeholder.svg",
        imageAlt: "Feature image",
        caption: "",
      },
      render: ({ id, eyebrow, title, body, imageUrl, imageAlt, caption }) => (
        <section id={id} className="xp-section">
          <SectionHeader eyebrow={eyebrow} title={title} body={body} />
          <figure className="xp-image-feature">
            <img src={imageUrl} alt={imageAlt || ""} />
            {caption ? <figcaption>{caption}</figcaption> : null}
          </figure>
        </section>
      ),
    },
    ResearchAgendaBlock: {
      label: "Research Agenda",
      fields: {
        id: { type: "text" },
        eyebrow: { type: "text" },
        title: { type: "text" },
        body: { type: "textarea" },
        imageUrl: { type: "text" },
        imageAlt: { type: "text" },
        items: agendaArrayField,
      },
      defaultProps: {
        id: "research-agenda",
        eyebrow: "Focus Areas",
        title: "Research Agenda",
        body: "Priority areas guiding faculty and student research.",
        imageUrl: "/Components/images/prism.png",
        imageAlt: "Research prism diagram",
        items: [{ text: "New agenda item" }],
      },
      render: ({ id, eyebrow, title, body, imageUrl, imageAlt, items }) => (
        <section id={id} className="xp-section xp-agenda">
          <SectionHeader eyebrow={eyebrow} title={title} body={body} />
          {imageUrl ? <img className="xp-agenda-image" src={imageUrl} alt={imageAlt || ""} /> : null}
          <ol>
            {asArray<AgendaItem>(items).map((item, index) => (
              <li key={`${item.text}-${index}`}>{item.text}</li>
            ))}
          </ol>
        </section>
      ),
    },
    CtaBlock: {
      label: "Call to Action",
      fields: {
        id: { type: "text" },
        title: { type: "text" },
        body: { type: "textarea" },
        label: { type: "text" },
        href: { type: "text" },
      },
      defaultProps: {
        id: "cta",
        title: "Ready to collaborate?",
        body: "Reach out to the office.",
        label: "Contact us",
        href: "/contact.html",
      },
      render: ({ id, title, body, label, href }) => (
        <section id={id} className="xp-cta">
          <h2>{title}</h2>
          <p>{body}</p>
          {label ? <a className="xp-button-primary" href={safeHref(href)}>{label}</a> : null}
        </section>
      ),
    },
    FooterLinksBlock: {
      label: "Footer Links",
      fields: {
        id: { type: "text" },
        logoUrl: { type: "text" },
        copyrightLabel: { type: "text" },
        links: linkArrayField,
      },
      defaultProps: {
        id: "footer",
        logoUrl: "/Components/images/spud-logo.png",
        copyrightLabel: "PeAS. All Rights Reserved.",
        links: [{ label: "Home", href: "/index.html", description: "" }],
      },
      render: ({ id, logoUrl, copyrightLabel, links }) => (
        <footer id={id} className="xp-footer">
          {logoUrl ? <img src={logoUrl} alt="" /> : null}
          <small>© {new Date().getFullYear()} {copyrightLabel}</small>
          <nav>
            {asArray<LinkItem>(links).map((link, index) => (
              <a key={`${link.href}-${index}`} href={safeHref(link.href)}>{link.label}</a>
            ))}
          </nav>
        </footer>
      ),
    },
    LoginShellBlock: {
      label: "Login Shell",
      fields: {
        id: { type: "text" },
        brandText: { type: "textarea" },
        logoUrl: { type: "text" },
        title: { type: "text" },
        subtitle: { type: "textarea" },
        schoolIdLabel: { type: "text" },
        schoolIdPlaceholder: { type: "text" },
        passwordLabel: { type: "text" },
        passwordPlaceholder: { type: "text" },
        submitLabel: { type: "text" },
        forgotPasswordLabel: { type: "text" },
        forgotPasswordTitle: { type: "text" },
        forgotPasswordSubtitle: { type: "textarea" },
        backgroundImageUrl: { type: "text" },
        graphicLogoUrl: { type: "text" },
        footerText: { type: "textarea" },
        layout: {
          type: "select",
          options: [
            { label: "Split", value: "split" },
            { label: "Focused", value: "focused" },
            { label: "Editorial", value: "editorial" },
          ],
        },
      },
      defaultProps: {
        id: "login-shell",
        brandText: "Paulinian electronic\nArchiving System (PeAS)",
        logoUrl: "/Components/images/peas_logo.png",
        title: "Welcome back",
        subtitle: "Please enter your details to access PeAS.",
        schoolIdLabel: "School ID",
        schoolIdPlaceholder: "Enter your School ID",
        passwordLabel: "Password",
        passwordPlaceholder: "••••••••",
        submitLabel: "Sign in",
        forgotPasswordLabel: "Forgot Password?",
        forgotPasswordTitle: "Forgot Password?",
        forgotPasswordSubtitle: "No worries, we'll send you reset instructions.",
        backgroundImageUrl: "/Components/images/office-20of-20research-20-26-20publications.png",
        graphicLogoUrl: "/Components/images/spud-logo.png",
        footerText: "PeAS. All Rights Reserved.",
        layout: "split",
      },
      render: (props) => (
        <section id={props.id} className={`xp-login-shell xp-login-${props.layout || "split"}`}>
          <div className="xp-login-form-surface" data-login-form-slot="true">
            <div className="xp-login-brand">
              {props.logoUrl ? <img src={props.logoUrl} alt="" /> : null}
              <span>{props.brandText}</span>
            </div>
            <h1>{props.title}</h1>
            <p>{props.subtitle}</p>
            <div className="xp-login-placeholder">
              <label>{props.schoolIdLabel}</label>
              <div>{props.schoolIdPlaceholder}</div>
              <label>{props.passwordLabel}</label>
              <div>{props.passwordPlaceholder}</div>
              <button type="button">{props.submitLabel}</button>
              <small>{props.forgotPasswordLabel}</small>
            </div>
            <small className="xp-login-footer">{props.footerText}</small>
          </div>
          <div className="xp-login-graphic" style={{ backgroundImage: `url(${props.backgroundImageUrl})` }}>
            {props.graphicLogoUrl ? <img src={props.graphicLogoUrl} alt="" /> : null}
          </div>
        </section>
      ),
    },
    BrandPanelBlock: {
      label: "Brand Panel",
      fields: {
        id: { type: "text" },
        title: { type: "text" },
        body: { type: "textarea" },
        imageUrl: { type: "text" },
        imageAlt: { type: "text" },
      },
      defaultProps: {
        id: "brand-panel",
        title: "Built for Paulinian research",
        body: "Use this panel to explain the system's purpose.",
        imageUrl: "/Components/images/peas.png",
        imageAlt: "PeAS logo",
      },
      render: ({ id, title, body, imageUrl, imageAlt }) => (
        <section id={id} className="xp-brand-panel">
          {imageUrl ? <img src={imageUrl} alt={imageAlt || ""} /> : null}
          <h2>{title}</h2>
          <p>{body}</p>
        </section>
      ),
    },
    HelpPanelBlock: {
      label: "Help Panel",
      fields: {
        id: { type: "text" },
        title: { type: "text" },
        body: { type: "textarea" },
        links: linkArrayField,
      },
      defaultProps: {
        id: "help-panel",
        title: "Need help signing in?",
        body: "Contact the Office of Research & Publications for access concerns.",
        links: [{ label: "Contact the Office", href: "/contact.html", description: "" }],
      },
      render: ({ id, title, body, links }) => (
        <section id={id} className="xp-help-panel">
          <h2>{title}</h2>
          <p>{body}</p>
          {asArray<LinkItem>(links).map((link, index) => (
            <a key={`${link.href}-${index}`} href={safeHref(link.href)}>{link.label}<Arrow /></a>
          ))}
        </section>
      ),
    },
  },
};
