import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // 检查食材总数
    const ingredientCount = await prisma.ingredient.count();
    console.log(`📊 数据库中共有 ${ingredientCount} 条食材记录`);
    
    // 获取前5条记录作为示例
    const sampleIngredients = await prisma.ingredient.findMany({
      take: 5,
      select: {
        name: true,
        energyKcal: true,
        proteinG: true,
        fatG: true,
        carbG: true
      }
    });
    
    console.log('\n🔍 前5条记录示例:');
    sampleIngredients.forEach(ingredient => {
      console.log(`- ${ingredient.name}: ${ingredient.energyKcal || 'N/A'}kcal, 蛋白质${ingredient.proteinG || 'N/A'}g, 脂肪${ingredient.fatG || 'N/A'}g, 碳水${ingredient.carbG || 'N/A'}g`);
    });
    
    // 检查有营养数据的记录数量
    const withNutritionCount = await prisma.ingredient.count({
      where: {
        energyKcal: {
          not: null
        }
      }
    });
    
    console.log(`\n✅ 其中有营养数据的记录: ${withNutritionCount} 条`);
    
  } catch (error) {
    console.error('❌ 验证过程中出现错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error); 