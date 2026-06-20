import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const INITIAL_BODY = `Hi {{HEAD_OF_SCHOOL}}, {{ADVANCEMENT_CONTACT}}, and {{ALUMNI_CONTACT}},

[Your outreach message for {{SCHOOL_NAME}} goes here. Edit this template in the Templates page — the system fills in the variables and never rewrites your words.]

Best,
Zach`;

const FOLLOW_UP_BODY = `Hi {{HEAD_OF_SCHOOL}}, {{ADVANCEMENT_CONTACT}}, and {{ALUMNI_CONTACT}},

[Your follow-up message for {{SCHOOL_NAME}} goes here.]

Best,
Zach`;

async function main() {
  await prisma.emailTemplate.upsert({
    where: { key: "INITIAL" },
    update: {},
    create: { key: "INITIAL", name: "Initial Outreach", subject: "Intern Ring Live Demo", body: INITIAL_BODY },
  });
  await prisma.emailTemplate.upsert({
    where: { key: "FOLLOW_UP" },
    update: {},
    create: { key: "FOLLOW_UP", name: "Follow-Up", subject: "Intern Ring Live Demo", body: FOLLOW_UP_BODY },
  });
  const defaults: Record<string, string> = {
    reviewMode: "true",        // require Zach's approval of researched contacts
    followUpDays: "20",
    autoSheetSync: "true",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log("Seeded templates + settings.");
}

main().finally(() => prisma.$disconnect());
