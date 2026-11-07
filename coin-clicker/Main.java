import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.io.UnsupportedEncodingException;
import java.util.Random;
import java.util.Scanner;

/**
 * Монетка-кликер для консоли (подходит для онлайн-компилятора Java).
 * Класс называется Main, так его обычно и ожидает онлайн-компилятор.
 *
 * Команды:
 *   Enter - кликнуть по монетке
 *   1     - магазин улучшений
 *   2     - статистика
 *   0     - выход
 *
 * Пассивный доход начисляется за время между вашими командами.
 */
public class Main {

    /** Улучшение, которое можно купить в магазине. */
    static class Upgrade {
        final String name;
        final double basePrice;
        final double clickBonus;   // прибавка к доходу за клик
        final double secondBonus;  // прибавка к доходу в секунду
        int owned;                 // сколько уже куплено

        Upgrade(String name, double basePrice, double clickBonus, double secondBonus) {
            this.name = name;
            this.basePrice = basePrice;
            this.clickBonus = clickBonus;
            this.secondBonus = secondBonus;
        }

        /** Каждая следующая покупка дорожает на 15%. */
        double price() {
            return Math.ceil(basePrice * Math.pow(1.15, owned));
        }

        String effect() {
            if (clickBonus > 0) {
                return "+" + (long) clickBonus + " за клик";
            }
            return "+" + (long) secondBonus + " в секунду";
        }
    }

    static final Upgrade[] SHOP = {
            new Upgrade("Крепкий палец",       15,   1,  0),
            new Upgrade("Автокликер",          50,   0,  1),
            new Upgrade("Монетный станок",    300,   0,  5),
            new Upgrade("Золотая перчатка",  1200,   5,  0),
            new Upgrade("Банк",              2500,   0, 30),
    };

    static final Random random = new Random();
    static double coins = 0;
    static double totalEarned = 0;
    static long totalClicks = 0;
    static long lastTime = System.currentTimeMillis();

    public static void main(String[] args) throws UnsupportedEncodingException {
        // Всегда выводим в UTF-8, чтобы русский текст не превращался в "?"
        System.setOut(new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8"));
        Scanner in = new Scanner(System.in);

        System.out.println("=== МОНЕТКА-КЛИКЕР ===");
        System.out.println("Нажимайте Enter, чтобы кликать по монетке!");

        while (true) {
            accrue();
            printStatus();
            System.out.print("Enter - клик | 1 - магазин | 2 - статистика | 0 - выход: ");
            System.out.flush();

            if (!in.hasNextLine()) {
                break; // ввод закончился (компилятор без окна ввода)
            }
            String cmd = in.nextLine().trim();

            if (cmd.isEmpty()) {
                click();
            } else if (cmd.equals("1")) {
                shop(in);
            } else if (cmd.equals("2")) {
                printStats();
            } else if (cmd.equals("0")) {
                break;
            } else {
                System.out.println("Неизвестная команда, попробуйте ещё раз.");
            }
        }

        System.out.println("Игра окончена. Всего заработано: " + fmt(totalEarned) + " монет. До встречи!");
    }

    /** Клик по монетке. */
    static void click() {
        double gain = clickPower();
        boolean crit = random.nextInt(100) < 5; // 5% шанс критического клика (x10)
        if (crit) {
            gain *= 10;
        }
        coins += gain;
        totalEarned += gain;
        totalClicks++;
        System.out.println(crit ? "КРИТИЧЕСКИЙ КЛИК! +" + fmt(gain) : "Клик! +" + fmt(gain));
    }

    /** Начисляет пассивный доход за время, прошедшее с прошлого вызова. */
    static void accrue() {
        long now = System.currentTimeMillis();
        double seconds = (now - lastTime) / 1000.0;
        lastTime = now;
        double gain = perSecond() * seconds;
        coins += gain;
        totalEarned += gain;
    }

    /** Магазин: покупка по номеру, Enter - назад в игру. */
    static void shop(Scanner in) {
        while (true) {
            accrue();
            System.out.println();
            System.out.println("--- МАГАЗИН (монет: " + fmt(coins) + ") ---");
            for (int i = 0; i < SHOP.length; i++) {
                Upgrade u = SHOP[i];
                System.out.println((i + 1) + ". " + u.name + " (" + u.effect() + ") - "
                        + fmt(u.price()) + " монет, куплено: " + u.owned);
            }
            System.out.print("Номер улучшения для покупки или Enter, чтобы вернуться: ");
            System.out.flush();

            if (!in.hasNextLine()) {
                return;
            }
            String line = in.nextLine().trim();
            accrue(); // время ожидания начисляем по старым ценам, до покупки
            if (line.isEmpty()) {
                return;
            }

            int choice;
            try {
                choice = Integer.parseInt(line);
            } catch (NumberFormatException e) {
                System.out.println("Введите номер улучшения.");
                continue;
            }
            if (choice < 1 || choice > SHOP.length) {
                System.out.println("Такого номера нет.");
                continue;
            }

            Upgrade u = SHOP[choice - 1];
            double price = u.price();
            if (coins >= price) {
                coins -= price;
                u.owned++;
                System.out.println("Куплено: " + u.name + "!");
            } else {
                System.out.println("Не хватает монет: нужно " + fmt(price) + ".");
            }
        }
    }

    static void printStatus() {
        System.out.println();
        System.out.println("Монеты: " + fmt(coins)
                + " | За клик: " + fmt(clickPower())
                + " | В секунду: " + fmt(perSecond()));
    }

    static void printStats() {
        System.out.println("--- СТАТИСТИКА ---");
        System.out.println("Всего кликов: " + totalClicks);
        System.out.println("Всего заработано: " + fmt(totalEarned));
        System.out.println("Доход за клик: " + fmt(clickPower()));
        System.out.println("Доход в секунду: " + fmt(perSecond()));
    }

    /** Доход за один клик с учётом покупок. */
    static double clickPower() {
        double power = 1;
        for (Upgrade u : SHOP) {
            power += u.owned * u.clickBonus;
        }
        return power;
    }

    /** Пассивный доход в секунду с учётом покупок. */
    static double perSecond() {
        double sum = 0;
        for (Upgrade u : SHOP) {
            sum += u.owned * u.secondBonus;
        }
        return sum;
    }

    /** Целое число с разделителями разрядов: 1,234,567. */
    static String fmt(double value) {
        return String.format("%,d", (long) value);
    }
}
