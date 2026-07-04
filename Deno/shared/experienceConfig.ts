import { z } from "zod";

export const EXPERIENCE_SCHEMA_VERSION = 1;

export const EXPERIENCE_COMPONENT_TYPES = [
  "AnnouncementBanner",
  "HeroBlock",
  "GalleryBlock",
  "QuickLinksBlock",
  "RichTextBlock",
  "ImageFeatureBlock",
  "ResearchAgendaBlock",
  "CtaBlock",
  "FooterLinksBlock",
  "LoginShellBlock",
  "BrandPanelBlock",
  "HelpPanelBlock",
] as const;

export const ExperienceComponentTypeSchema = z.enum(EXPERIENCE_COMPONENT_TYPES);

export const PuckComponentDataSchema = z.object({
  type: ExperienceComponentTypeSchema,
  props: z.record(z.string(), z.unknown()).default({}),
  readOnly: z.record(z.string(), z.boolean()).optional(),
});

export const PuckPageDataSchema = z.object({
  root: z.record(z.string(), z.unknown()).default({}),
  content: z.array(PuckComponentDataSchema).default([]),
  zones: z.record(z.string(), z.array(PuckComponentDataSchema)).optional(),
});

export const ExperienceThemeSchema = z.object({
  brandName: z.string().min(1).max(120),
  logoUrl: z.string().min(1),
  faviconUrl: z.string().min(1).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  primaryDarkColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  pageBackground: z.string().min(1),
  surfaceColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  mutedTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontFamily: z.string().min(1),
  radius: z.enum(["compact", "soft", "rounded"]),
  motion: z.enum(["none", "reduced", "standard"]),
});

export const ExperiencePageSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(300).optional(),
  data: PuckPageDataSchema,
});

export const ExperiencePersonalizationSchema = z.object({
  enabled: z.boolean().default(true),
  greetingTemplate: z.string().max(140).default("Welcome back, {{first_name}}"),
  guestGreeting: z.string().max(140).default("Welcome to PeAS"),
  modules: z.array(z.enum([
    "roleQuickLinks",
    "savedDocuments",
    "recentActivity",
    "adminShortcuts",
  ])).default(["roleQuickLinks", "savedDocuments", "recentActivity"]),
});

export const ExperienceConfigSchema = z.object({
  schemaVersion: z.literal(EXPERIENCE_SCHEMA_VERSION),
  title: z.string().min(1).max(160),
  updatedAt: z.string().optional(),
  theme: ExperienceThemeSchema,
  pages: z.object({
    landing: ExperiencePageSchema,
    login: ExperiencePageSchema,
  }),
  personalization: ExperiencePersonalizationSchema,
});

export const UserExperiencePreferencesSchema = z.object({
  landingDensity: z.enum(["comfortable", "compact"]).default("comfortable"),
  preferredModules: z.array(z.string().max(80)).default([]),
  hiddenModules: z.array(z.string().max(80)).default([]),
});

export type ExperienceConfig = z.infer<typeof ExperienceConfigSchema>;
export type UserExperiencePreferences = z.infer<typeof UserExperiencePreferencesSchema>;

export function parseExperienceConfig(input: unknown): ExperienceConfig {
  return ExperienceConfigSchema.parse(input);
}

export function parseUserExperiencePreferences(input: unknown): UserExperiencePreferences {
  return UserExperiencePreferencesSchema.parse(input ?? {});
}

export const defaultExperienceConfig: ExperienceConfig = {
  schemaVersion: EXPERIENCE_SCHEMA_VERSION,
  title: "PeAS Experience",
  theme: {
    brandName: "Paulinian electronic Archiving System",
    logoUrl: "/Components/images/peas.png",
    faviconUrl: "/Components/images/peas-ico.png",
    primaryColor: "#006A4E",
    primaryDarkColor: "#00523D",
    accentColor: "#FDB813",
    pageBackground: "linear-gradient(to bottom right, #fdfae8, #e6f4ea)",
    surfaceColor: "#FFFFFF",
    textColor: "#1F2937",
    mutedTextColor: "#6B7280",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    radius: "soft",
    motion: "standard",
  },
  pages: {
    landing: {
      title: "Office of Research & Publications",
      description: "The public PeAS landing page.",
      data: {
        root: { props: { title: "Office of Research & Publications" } },
        content: [
          {
            type: "HeroBlock",
            props: {
              id: "hero-current-peas",
              eyebrow: "St. Paul University Dumaguete",
              title: "Welcome to the Office of Research & Publications",
              body: "Sharing the institution's research activities, initiatives, and publications - innovations and scientific discoveries that expand human knowledge and serve the broader community.",
              logoUrl: "/Components/images/peas.png",
              images: [
                { url: "/Components/images/1.jpg", alt: "Research Initiative Photo 1" },
                { url: "/Components/images/2.jpg", alt: "Research Initiative Photo 2" },
                { url: "/Components/images/3.jpg", alt: "Research Initiative Photo 3" },
                { url: "/Components/images/4.jpg", alt: "Research Initiative Photo 4" },
              ],
              primaryLabel: "View Research Agenda",
              primaryHref: "#research-agenda",
              secondaryLabel: "Contact the Office",
              secondaryHref: "/contact.html",
              variant: "split-gallery",
            },
          },
          {
            type: "QuickLinksBlock",
            props: {
              id: "quick-links-current",
              title: "Explore PeAS",
              links: [
                {
                  label: "Our Mission",
                  href: "#mission",
                  description: "Excellence, integrity, and ethics in the pursuit of truth, knowledge, and holistic formation.",
                },
                {
                  label: "Organizational Chart",
                  href: "#org-chart",
                  description: "Meet the team driving research, publications, and innovation at the university.",
                },
                {
                  label: "Research Agenda",
                  href: "#research-agenda",
                  description: "Twenty focus areas aligned with national priorities and global development goals.",
                },
              ],
            },
          },
          {
            type: "RichTextBlock",
            props: {
              id: "mission",
              eyebrow: "Our Mission",
              title: "Advancing knowledge in service of the community",
              body: "The Office of Research & Publications of St. Paul University Dumaguete supports faculty and students in meaningful research that improves the institution and the populations we serve.\n\nOur innovations and scientific discoveries are expanding human knowledge and extending help to improve the institution and the public community.\n\nThe office provides standards aligned with its newly crafted research agenda and in parallel with the priorities mandated by several agencies towards sustainability and development goals of our country.",
            },
          },
          {
            type: "ImageFeatureBlock",
            props: {
              id: "org-chart",
              eyebrow: "Team",
              title: "Organizational Chart",
              body: "The structure behind the Office of Research & Publications.",
              imageUrl: "/Components/images/org-chart.png",
              imageAlt: "Organizational chart for the Office of Research and Publications",
              caption: "Click to view the full organizational chart.",
            },
          },
          {
            type: "ResearchAgendaBlock",
            props: {
              id: "research-agenda",
              eyebrow: "Focus Areas",
              title: "Research Agenda",
              body: "Twenty priority areas guiding faculty and student research - from Paulinian identity and formation to technology, sustainability, and global partnerships.",
              imageUrl: "/Components/images/prism.png",
              imageAlt: "Research prism diagram",
              items: [
                { text: "Paulinian Spirituality/Identity and its impact to international community and global partnerships" },
                { text: "Paulinian Mission / Vision / Philosophy / Goals" },
                { text: "Paulinian Roots and Formation" },
                { text: "Advocacy (Peace, Pro-Life, Environment, Disaster & Risks Management)" },
                { text: "Global Mental Health and Wellness" },
                { text: "Synodal Church: Communion, Participation, and Mission" },
                { text: "Inclusivity and Equity in Education" },
                { text: "Curriculum development and Innovation geared towards internalization and global partnership" },
                { text: "OBE - Instruction" },
                { text: "Technology Integration" },
                { text: "Faculty / Staff Development" },
                { text: "Infrastructure / Software Development and Innovation" },
                { text: "Financial Management, Sustainability, and Energy Security" },
                { text: "Environmental Discipline and Stewardship" },
                { text: "Ethical Leaders & Professionals" },
                { text: "Cutting-edge Resilient Visionaries & Innovators; Engaging, Trustworthy Team Builders & Mentors; Reliable, Productive Experts & Implementers; Dedicated, Transformative Supporters & Stewardship in the context of international community and global partnerships" },
                { text: "Civic and Community Involvement" },
                { text: "Equality and Diversity" },
                { text: "Economic cooperation and integration" },
                { text: "Student and Faculty Mobility" },
              ],
            },
          },
          {
            type: "CtaBlock",
            props: {
              id: "bottom-cta",
              title: "Collaborate with the Office of Research & Publications",
              body: "Have a research inquiry, an idea for a publication, or a question about our work? We'd love to hear from you.",
              label: "Get in touch",
              href: "/contact.html",
            },
          },
          {
            type: "FooterLinksBlock",
            props: {
              id: "footer-links",
              copyrightLabel: "PeAS. All Rights Reserved.",
              logoUrl: "/Components/images/spud-logo.png",
              links: [
                { label: "Home", href: "/index.html" },
                { label: "Contact", href: "/contact.html" },
                { label: "Terms & Conditions", href: "/pages/miscellaneous/T&A-Public.html" },
                { label: "Privacy Policy", href: "/pages/miscellaneous/Privacy.html" },
              ],
            },
          },
        ],
      },
    },
    login: {
      title: "PeAS Login",
      description: "The configurable login experience.",
      data: {
        root: { props: { title: "PeAS Login" } },
        content: [
          {
            type: "LoginShellBlock",
            props: {
              id: "login-shell-current",
              brandText: "Paulinian electronic\nArchiving System (PeAS)",
              logoUrl: "/Components/images/peas_logo.png",
              title: "Welcome back",
              subtitle: "Please enter your details to access the PeAS.",
              schoolIdLabel: "School ID",
              schoolIdPlaceholder: "Enter your School ID",
              passwordLabel: "Password",
              passwordPlaceholder: "••••••••",
              submitLabel: "Sign in",
              forgotPasswordLabel: "Forgot Password?",
              forgotPasswordTitle: "Forgot Password?",
              forgotPasswordSubtitle: "No worries, we'll send you reset instructions.",
              backgroundImageUrl: "https://storage.googleapis.com/oa_disk001/spudlms/84/school_logo/1627354824-105.jpeg",
              graphicLogoUrl: "https://www.spud.edu.ph/assets/logo/spud_logo_s.png",
              footerText: "PeAS. All Rights Reserved. L. Rovira Rd, Bantayan, Dumaguete, Negros Oriental.",
              layout: "split",
            },
          },
        ],
      },
    },
  },
  personalization: {
    enabled: true,
    greetingTemplate: "Welcome back, {{first_name}}",
    guestGreeting: "Welcome to PeAS",
    modules: ["roleQuickLinks", "savedDocuments", "recentActivity"],
  },
};
