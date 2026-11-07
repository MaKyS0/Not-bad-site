package megawall;

import mindustry.content.Items;
import mindustry.game.Team;
import mindustry.gen.Bullet;
import mindustry.gen.Building;
import mindustry.type.Category;
import mindustry.type.ItemStack;
import mindustry.world.blocks.defense.Wall;
import mindustry.world.meta.BuildVisibility;

/**
 * Мега-стена 3×3: неубиваемая стена.
 *
 * Враги, их снаряды, взрывы, лазеры и удары юнитов не снимают с неё здоровье.
 * Игрок может снести её обычным способом, как любую стену.
 */
public class MegaWall extends Wall {

    public MegaWall(String name) {
        super(name);
        size = 3;
        // Число показывается в интерфейсе; урон всё равно не применяется (см. MegaWallBuild).
        health = 1_000_000;
        absorbLasers = true;
        insulated = true;
        buildVisibility = BuildVisibility.shown;
        // Стоимость можно поменять здесь.
        requirements(Category.defense, ItemStack.with(
                Items.titanium, 600,
                Items.thorium, 400,
                Items.plastanium, 200));
        // Игра создаёт строение через buildType, поэтому подменяем его на свой класс.
        buildType = () -> new MegaWallBuild();
    }

    /**
     * Строение мега-стены. Переопределяет каждый путь, которым игра наносит урон,
     * поэтому здоровье не уменьшается ни от одного источника.
     */
    public class MegaWallBuild extends WallBuild {

        @Override
        public void damage(float amount) {
        }

        @Override
        public void damage(float amount, boolean withEffect) {
        }

        @Override
        public void damage(Team source, float amount) {
        }

        @Override
        public void damage(Bullet bullet, Team source, float amount) {
        }

        @Override
        public void damagePierce(float amount) {
        }

        @Override
        public void damagePierce(float amount, boolean withEffect) {
        }

        @Override
        public void damageArmorMult(float amount, float armorMultiplier) {
        }

        @Override
        public void damageArmorMult(float amount, float armorMultiplier, boolean withEffect) {
        }

        @Override
        public void damageContinuous(float amount) {
        }

        @Override
        public void damageContinuousArmorMult(float amount, float armorMultiplier) {
        }

        @Override
        public void damageContinuousPierce(float amount) {
        }

        @Override
        public void kill() {
        }
    }
}
