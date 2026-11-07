package megawall;

import mindustry.mod.Mod;

/**
 * Точка входа мода. Mindustry создаёт этот класс при загрузке модов
 * и вызывает loadContent(), где регистрируется блок.
 */
public class MegaWallMod extends Mod {

    public static MegaWall megaWall;

    @Override
    public void loadContent() {
        // Внутреннее имя блока станет "megawall-mega-wall" (имя мода + имя блока).
        megaWall = new MegaWall("mega-wall");
    }
}
