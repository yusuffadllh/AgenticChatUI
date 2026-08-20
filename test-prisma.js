import { prisma } from './lib/prisma.js';

async function main() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 1 },
    });
    console.log("Settings:", settings);
  } catch (error) {
    console.error("Prisma Error:", error);
  }
}

main();
