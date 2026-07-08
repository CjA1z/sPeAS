import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Building2, FileSearch, GraduationCap, Search, Sparkles, UsersRound } from "lucide-react";
import { motion } from "motion/react";
import { CategoryIcon } from "../../components/documents/CategoryIcon";
import { PublicDocumentResultCard } from "../../components/public/PublicDocumentResultCard";
import { PublicFooter } from "../../components/public/PublicFooter";
import { PublicNavbar } from "../../components/public/PublicNavbar";
import { OrgChart } from "../../components/public/OrgChart";
import { PrismDiagram } from "../../components/public/PrismDiagram";
import { Button } from "../../components/ui/button";
import { fetchPublicHomeData, keywordSearchUrl, searchResultsUrl, type PublicHomeData } from "../../lib/api/public";
import type { SessionResponse } from "../../lib/api/auth";
import { CATEGORY_ORDER, getCategoryMeta, type DocumentCategory } from "../../lib/constants/categories";

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
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchPublicHomeData()
      .then((homeData) => {
        if (!mounted) return;
        setData(homeData);
        setSession(homeData.session);
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

  const submitSearch = useCallback(() => {
    window.location.href = searchResultsUrl(query, category);
  }, [category, query]);

  return (
    <div className="peas-public-page">
      <PublicNavbar session={session} onSessionChange={setSession} />

      <main>
        <section className="peas-public-hero" aria-labelledby="public-home-title">
          <img src="/Components/images/1.jpg" alt="" className="peas-public-hero__image" />
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
            <h1 id="public-home-title">Office of Research & Publications</h1>
            <p>
              Explore PeAS, the university repository for research activities, initiatives, theses,
              dissertations, journals, and scholarly work.
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
              <a href="#research-agenda">Research Agenda</a>
              <a href="/contact.html">Contact the Office</a>
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

        <section className="peas-public-split" id="mission" aria-labelledby="mission-title">
          <div className="peas-public-section-head">
            <span>Mission</span>
            <h2 id="mission-title">Research in service of community</h2>
            <p>
              The office supports faculty and student research that advances knowledge, promotes
              ethical inquiry, and responds to the needs of the populations we serve.
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

        <section className="peas-public-media-section" aria-labelledby="org-title">
          <div className="peas-public-section-head">
            <span>Office Structure</span>
            <h2 id="org-title">Research and publications team</h2>
            <p>The unit coordinating research activity, publication support, and institutional scholarly output.</p>
          </div>
          <OrgChart />
        </section>

        <section className="peas-public-band" id="research-agenda" aria-labelledby="agenda-title">
          <div className="peas-public-section-head">
            <span>Focus Areas</span>
            <h2 id="agenda-title">Research Agenda</h2>
            <p>Twenty priority areas guide faculty and student research across identity, education, technology, wellness, sustainability, and partnerships.</p>
          </div>
          <div className="peas-public-agenda">
            {agendaItems.map((item, index) => (
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
      </main>

      <PublicFooter />
    </div>
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
