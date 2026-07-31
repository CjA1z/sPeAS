import { assertEquals, assert } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  defaultExperienceConfig,
  EXPERIENCE_DEFAULT_ORGANIZATION_ROLES,
  EXPERIENCE_ORGANIZATION_ROLE_IDS,
  ExperienceOrganizationRolesSchema,
  getExperiencePublishErrors,
  migrateExperienceConfigV1ToV2,
} from "../shared/experienceConfig.ts";

Deno.test("v1 experience content migrates while layout, links, and theme stay locked", () => {
  const input = structuredClone(defaultExperienceConfig) as any;
  input.schemaVersion = 1;
  input.theme = { primaryColor: "#FF0000" };
  input.pages.landing.data.content.reverse();
  const hero = input.pages.landing.data.content.find((block: any) => block.type === "HeroBlock");
  hero.props.title = "Approved new title";
  hero.props.primaryHref = "https://attacker.example";
  input.pages.landing.data.content.push({ type: "AnnouncementBanner", props: { text: "Injected" } });

  const migrated = migrateExperienceConfigV1ToV2(input);
  assertEquals(migrated.schemaVersion, 2);
  assertEquals("theme" in migrated, false);
  assertEquals(migrated.pages.landing.data.content.map((block) => block.type), defaultExperienceConfig.pages.landing.data.content.map((block) => block.type));
  const migratedHero = migrated.pages.landing.data.content.find((block) => block.type === "HeroBlock")!;
  assertEquals(migratedHero.props.title, "Approved new title");
  assertEquals(migratedHero.props.primaryHref, "#research-agenda");
});

Deno.test("fixed quick-link destinations and agenda item count cannot be changed", () => {
  const input = structuredClone(defaultExperienceConfig) as any;
  const quickLinks = input.pages.landing.data.content.find((block: any) => block.type === "QuickLinksBlock");
  quickLinks.props.links = [{ label: "Changed", description: "Changed", href: "javascript:alert(1)" }];
  const agenda = input.pages.landing.data.content.find((block: any) => block.type === "ResearchAgendaBlock");
  agenda.props.items = [{ text: "One item only" }];
  const migrated = migrateExperienceConfigV1ToV2(input);
  const nextQuickLinks = migrated.pages.landing.data.content.find((block) => block.type === "QuickLinksBlock")!;
  const nextAgenda = migrated.pages.landing.data.content.find((block) => block.type === "ResearchAgendaBlock")!;
  assertEquals((nextQuickLinks.props.links as any[])[0].href, "#mission");
  assertEquals((nextAgenda.props.items as any[]).length, 20);
});

Deno.test("publishing requires alt text for meaningful images", () => {
  const config = structuredClone(defaultExperienceConfig);
  const hero = config.pages.landing.data.content.find((block) => block.type === "HeroBlock")!;
  (hero.props.images as any[])[0].alt = "";
  assert(getExperiencePublishErrors(config).some((error) => error.includes("requires alternative text")));
});

Deno.test("organization roles keep fixed identity, order, and group classification", () => {
  const input = structuredClone(defaultExperienceConfig) as any;
  const chart = input.pages.landing.data.content.find((block: any) =>
    block.type === "ImageFeatureBlock" && block.props.id === "org-chart"
  );
  const roles = chart.props.roles as any[];
  const director = roles.find((role) => role.id === "director-orp");
  Object.assign(director, {
    title: "  Director of Research  ",
    label: "  Research Director  ",
    caption: "  Research Office  ",
    name: "  Dr. Ada Paul  ",
    photo: "  /storage/site-branding/team/director.webp  ",
    photoAlt: "  Dr. Ada Paul in university attire  ",
    group: true,
    summary: "  Coordinates the university research and publication program.  ",
  });
  Object.assign(roles.find((role) => role.id === "president"), {
    title: "   ",
    label: "   ",
    caption: "   ",
    name: "   ",
    summary: "   ",
  });
  roles.find((role) => role.id === "editorial-board").group = false;
  chart.props.roles = roles.reverse();
  chart.props.roles.push({
    id: "injected-role",
    title: "Injected",
    group: false,
  });

  const migrated = migrateExperienceConfigV1ToV2(input);
  const migratedChart = migrated.pages.landing.data.content.find((block) =>
    block.type === "ImageFeatureBlock" && block.props.id === "org-chart"
  )!;
  const migratedRoles = migratedChart.props.roles as any[];
  const migratedDirector = migratedRoles.find((role) =>
    role.id === "director-orp"
  );
  const migratedPresident = migratedRoles.find((role) =>
    role.id === "president"
  );

  assertEquals(migratedRoles.map((role) => role.id), [
    ...EXPERIENCE_ORGANIZATION_ROLE_IDS,
  ]);
  assertEquals(
    migratedRoles.map((role) => role.group),
    EXPERIENCE_DEFAULT_ORGANIZATION_ROLES.map((role) => role.group),
  );
  assertEquals(migratedDirector, {
    id: "director-orp",
    title: "Director of Research",
    label: "Research Director",
    caption: "Research Office",
    name: "Dr. Ada Paul",
    photo: "/storage/site-branding/team/director.webp",
    photoAlt: "Dr. Ada Paul in university attire",
    group: false,
    summary: "Coordinates the university research and publication program.",
  });
  assertEquals(migratedPresident, EXPERIENCE_DEFAULT_ORGANIZATION_ROLES[0]);
  ExperienceOrganizationRolesSchema.parse(migratedRoles);
});

Deno.test("organization role migration supplies defaults and rejects unapproved photo URLs", () => {
  const legacy = structuredClone(defaultExperienceConfig) as any;
  legacy.schemaVersion = 1;
  const legacyChart = legacy.pages.landing.data.content.find((block: any) =>
    block.type === "ImageFeatureBlock" && block.props.id === "org-chart"
  );
  delete legacyChart.props.roles;
  const migratedLegacy = migrateExperienceConfigV1ToV2(legacy);
  const migratedLegacyChart = migratedLegacy.pages.landing.data.content.find((
    block,
  ) => block.type === "ImageFeatureBlock" && block.props.id === "org-chart")!;
  assertEquals(
    migratedLegacyChart.props.roles,
    EXPERIENCE_DEFAULT_ORGANIZATION_ROLES,
  );

  const input = structuredClone(defaultExperienceConfig) as any;
  const chart = input.pages.landing.data.content.find((block: any) =>
    block.type === "ImageFeatureBlock" && block.props.id === "org-chart"
  );
  chart.props.roles.find((role: any) => role.id === "president").photo =
    "https://attacker.example/president.png";
  const migrated = migrateExperienceConfigV1ToV2(input);
  const migratedChart = migrated.pages.landing.data.content.find((block) =>
    block.type === "ImageFeatureBlock" && block.props.id === "org-chart"
  )!;
  const president = (migratedChart.props.roles as any[]).find((role) =>
    role.id === "president"
  );
  assertEquals(president.photo, "");
});

Deno.test("publishing requires alt text for organization role photos", () => {
  const config = structuredClone(defaultExperienceConfig);
  const chart = config.pages.landing.data.content.find((block) =>
    block.type === "ImageFeatureBlock" && block.props.id === "org-chart"
  )!;
  const president = (chart.props.roles as any[]).find((role) =>
    role.id === "president"
  );
  president.photo = "/storage/site-branding/team/president.png";
  president.photoAlt = "";

  assert(
    getExperiencePublishErrors(config).includes(
      "University President photo requires alternative text.",
    ),
  );
});
