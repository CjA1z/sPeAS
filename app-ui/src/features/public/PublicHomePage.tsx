import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Building2, FileSearch, GraduationCap, Search, Sparkles, UsersRound } from "lucide-react";
import { motion } from "motion/react";
import { CategoryIcon } from "../../components/documents/CategoryIcon";
import { PublicDocumentResultCard } from "../../components/public/PublicDocumentResultCard";
import { OrgChart, type OrgChartRoleContent } from "../../components/public/OrgChart";
import { PublicPageShell } from "../../components/public/PublicPageShell";
import { usePublicSession } from "../../components/public/PublicSessionProvider";
import { PrismDiagram } from "../../components/public/PrismDiagram";
import { Button } from "../../components/ui/button";
import { fetchPublicHomeData, keywordSearchUrl, searchResultsUrl, type PublicHomeData } from "../../lib/api/public";
import { CATEGORY_ORDER, getCategoryMeta, type DocumentCategory } from "../../lib/constants/categories";
import { experienceBlockProps, usePublicExperience } from "../../lib/api/experience";

const agendaItems = [
  "Paulinian Spirituality/Identity and its impact to international community and global partnerships",
  "Paulinian Mission / Vision / Philosophy / Goals",
  "Paulinian Roots and Formation",
  "Advocacy: Peace, Pro-Life, Environment, Disaster & Risks Management",
  "Global Mental Health and Wellness",
  "Synodal Church: Communion, Participation, and Mission",
  "Inclusivity and Equity in Education",
  "Curriculum development and Innovation geared towards internationalization and global partnership",
  "OBE - Instruction",
  "Technology Integration",
  "Faculty / Staff Development",
  "Infrastructure / Software Development and Innovation",
  "Financial Management, Sustainability, and Energy Security",
  "Environmental Discipline and Stewardship",
  "Ethical Leaders & Professionals",
  "Resilient visionaries, innovators, mentors, implementers, supporters, and stewardship",
  "Civic and Community Involvement",
  "Equality and Diversity",
  "Economic cooperation and integration",
  "Student and Faculty Mobility",
];

export function PublicHomePage() {
  const [data, setData] = useState<PublicHomeData | null>(null);
  const { session } = usePublicSession();
  const { config } = usePublicExperience("landing");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchPublicHomeData()
      .then((homeData) => {
        if (!mounted) return;
        setData(homeData);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const categoryCounts = data?.categories ?? [];
  const totalWorks = useMemo(() => categoryCounts.reduce((sum, item) => sum + item.count, 0), [categoryCounts]);
  const latestDocuments = data?.latestDocuments ?? [];
  const trendingKeywords = data?.trendingKeywords ?? [];
  const hero = experienceBlockProps(config, "landing", "HeroBlock");
  const mission = experienceBlockProps(config, "landing", "RichTextBlock");
  const quickLinks = experienceBlockProps(config, "landing", "QuickLinksBlock");
  const organization = experienceBlockProps(config, "landing", "ImageFeatureBlock");
  const agenda = experienceBlockProps(config, "landing", "ResearchAgendaBlock");
  const contactCta = experienceBlockProps(config, "landing", "CtaBlock");
  const heroImages = Array.isArray(hero.images) ? hero.images as Array<{ url?: string; alt?: string }> : [];
  const agendaContent = Array.isArray(agenda.items)
    ? (agenda.items as Array<{ text?: string }>).map((item) => String(item.text ?? "")).filter(Boolean)
    : agendaItems;
  const quickLinkItems = Array.isArray(quickLinks.links)
    ? quickLinks.links as Array<{ label?: string; description?: string; href?: string }>
    : [];
  const organizationRoles = Array.isArray(organization.roles)
    ? organization.roles as OrgChartRoleContent[]
    : undefined;

  const submitSearch = useCallback(() => {
    window.location.href = searchResultsUrl(query, category);
  }, [category, query]);

  return (
    <PublicPageShell>
        <section className="peas-public-hero" aria-labelledby="public-home-title">
          <div className="peas-public-hero__images" aria-label="Featured research photos">
            {(heroImages.length ? heroImages : [{ url: "/Components/images/1.jpg", alt: "" }]).slice(0, 4).map((image, index) => (
              <img src={image.url || "/Components/images/1.jpg"} alt={image.alt || ""} className="peas-public-hero__image" key={`${image.url}-${index}`} />
            ))}
          </div>
          <div className="peas-public-hero__overlay" />
          <motion.div
            className="peas-public-hero__content"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <div className="peas-public-hero-kicker">
              <span className="peas-public-hero-logo-group">
                <img className="peas-public-hero-logo-mark" src="/Components/images/spud_logo_s.png" alt="St. Paul University Dumaguete logo" />
                <img className="peas-public-hero-logo-mark" src="/Components/images/peas.png" alt="PeAS system logo" />
              </span>
            </div>
            <h1 id="public-home-title">{String(hero.title || "Office of Research & Publications")}</h1>
            <p>
              {String(hero.body || "Explore PeAS, the university repository for research activities, initiatives, theses, dissertations, journals, and scholarly work.")}
            </p>
            <form
              className="peas-public-hero-search"
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
            >
              <Search aria-hidden="true" />
              <input
                aria-label="Search documents"
                placeholder="Search by title, author, keyword, or topic"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              <select
                aria-label="Filter search category"
                value={category}
                onChange={(event) => setCategory(event.currentTarget.value as DocumentCategory)}
              >
                {CATEGORY_ORDER.map((item) => (
                  <option value={item} key={item}>
                    {getCategoryMeta(item).label}
                  </option>
                ))}
              </select>
              <Button type="submit">
                Search
                <ArrowRight aria-hidden="true" />
              </Button>
            </form>
            <div className="peas-public-hero-actions">
              <a href="#research-agenda">{String(hero.primaryLabel || "Research Agenda")}</a>
              <a href="/contact.html">{String(hero.secondaryLabel || "Contact the Office")}</a>
            </div>
          </motion.div>
        </section>

        <section className="peas-public-band" aria-labelledby="discover-title">
          <div className="peas-public-section-head">
            <span>Discover</span>
            <h2 id="discover-title">Browse the repository by collection</h2>
            <p>Jump into theses, dissertations, Confluence volumes, and Synergy collections.</p>
          </div>
          <div className="peas-public-stats" aria-label="Repository summary">
            <StatItem label="Repository Works" value={loading ? "--" : String(totalWorks)} />
            <StatItem label="Authors" value={loading ? "--" : String(data?.stats.totalAuthors ?? 0)} />
          </div>
          <div className="peas-public-category-grid">
            {CATEGORY_ORDER.filter((item) => item !== "All").map((item, index) => {
              const meta = getCategoryMeta(item);
              const count = categoryCounts.find((row) => row.name === item)?.count ?? 0;
              return (
                <motion.a
                  className={`peas-public-category-card peas-category-tone-${meta.tone}`}
                  href={searchResultsUrl("", item)}
                  key={item}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <span className="peas-public-category-card__icon">
                    <CategoryIcon category={item} />
                  </span>
                  <strong>{meta.label}</strong>
                  <small>{count} {count === 1 ? "entry" : "entries"}</small>
                </motion.a>
              );
            })}
          </div>
        </section>

        {quickLinkItems.length ? <section className="peas-public-quick-links" aria-labelledby="quick-links-title"><div className="peas-public-section-head"><span>Explore</span><h2 id="quick-links-title">{String(quickLinks.title || "Explore PeAS")}</h2></div><div>{quickLinkItems.map((item, index) => <a href={String(item.href || ["#mission", "#org-chart", "#research-agenda"][index] || "#")} key={`${item.label}-${index}`}><strong>{item.label}</strong><span>{item.description}</span></a>)}</div></section> : null}

        <section className="peas-public-split" id="mission" aria-labelledby="mission-title">
          <div className="peas-public-section-head">
            <span>Mission</span>
            <h2 id="mission-title">{String(mission.title || "Research in service of community")}</h2>
            <p>
              {String(mission.body || "The office supports faculty and student research that advances knowledge, promotes ethical inquiry, and responds to the needs of the populations we serve.")}
            </p>
          </div>
          <div className="peas-public-feature-list">
            <FeatureItem icon={<GraduationCap aria-hidden="true" />} title="Paulinian formation" />
            <FeatureItem icon={<Sparkles aria-hidden="true" />} title="Innovation and discovery" />
            <FeatureItem icon={<UsersRound aria-hidden="true" />} title="Community partnership" />
          </div>
        </section>

        <section className="peas-public-band" aria-labelledby="prism-title">
          <div className="peas-public-section-head">
            <span>Framework</span>
            <h2 id="prism-title">The PRISM framework</h2>
            <p>Right mindset, right method, and right motivation driving transformative outcome-based education.</p>
          </div>
          <PrismDiagram />
        </section>

        <section className="peas-public-band peas-public-band--soft" aria-labelledby="latest-title">
          <div className="peas-public-section-head">
            <span>Recent Works</span>
            <h2 id="latest-title">Latest repository entries</h2>
            <p>Newly available research records from the PeAS archive.</p>
          </div>
          <div className="peas-public-document-grid">
            {latestDocuments.length > 0 ? latestDocuments.map((document) => (
              <PublicDocumentResultCard document={document} session={session} key={`${document.id}-${document.isCompiled}`} />
            )) : (
              <div className="peas-public-empty">
                <FileSearch aria-hidden="true" />
                <p>No recent documents were returned.</p>
              </div>
            )}
          </div>
        </section>

        <section className="peas-public-media-section" id="org-chart" aria-labelledby="org-title">
          <div className="peas-public-section-head">
            <span>Office Structure</span>
            <h2 id="org-title">{String(organization.title || "Research and publications team")}</h2>
            <p>{String(organization.body || "The unit coordinating research activity, publication support, and institutional scholarly output.")}</p>
          </div>
          <OrgChart roles={organizationRoles} />
        </section>

        <section className="peas-public-band" id="research-agenda" aria-labelledby="agenda-title">
          <div className="peas-public-section-head">
            <span>Focus Areas</span>
            <h2 id="agenda-title">{String(agenda.title || "Research Agenda")}</h2>
            <p>{String(agenda.body || "Twenty priority areas guide faculty and student research across identity, education, technology, wellness, sustainability, and partnerships.")}</p>
          </div>
          {agenda.imageUrl ? <img className="peas-public-agenda-image" src={String(agenda.imageUrl)} alt={String(agenda.imageAlt || "")} /> : null}
          <div className="peas-public-agenda">
            {agendaContent.map((item, index) => (
              <motion.div
                className="peas-public-agenda-item"
                key={item}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: Math.min(index * 0.015, 0.18) }}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {trendingKeywords.length > 0 ? (
          <section className="peas-public-keywords" aria-labelledby="keywords-title">
            <div className="peas-public-section-head">
              <span>Trending</span>
              <h2 id="keywords-title">Popular search paths</h2>
            </div>
            <div>
              {trendingKeywords.map((keyword) => (
                <a href={keywordSearchUrl(keyword)} key={keyword}>
                  {keyword}
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <section className="peas-public-contact-cta" aria-labelledby="public-contact-cta-title">
          <div><span>Connect</span><h2 id="public-contact-cta-title">{String(contactCta.title || "Contact the Office of Research & Publications")}</h2><p>{String(contactCta.body || "Questions about research, publications, or repository access? Send the office an inquiry.")}</p></div>
          <a href="/contact.html">{String(contactCta.label || "Get in touch")}</a>
        </section>
    </PublicPageShell>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function FeatureItem({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div>
      {icon}
      <span>{title}</span>
    </div>
  );
}
