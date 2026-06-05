import java.io.BufferedReader;
import java.io.InputStreamReader;

/**
 * Observes process memory via /proc/self/status on Linux.
 */
public class MemoryStats {
    static String readStatusField(String field) {
        try {
            Process p = Runtime.getRuntime().exec(new String[]{"bash", "-c", "grep '^" + field + "' /proc/self/status"});
            BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()));
            String line = br.readLine();
            p.waitFor();
            if (line != null && line.contains(":")) {
                return line.split(":", 2)[1].trim();
            }
        } catch (Exception e) {
            return "N/A: " + e.getMessage();
        }
        return "N/A";
    }

    public static void main(String[] args) {
        System.out.println("=== Virtual Memory Observation (Java) ===");
        Runtime rt = Runtime.getRuntime();

        System.out.println("Before allocation:");
        System.out.println("  VmSize: " + readStatusField("VmSize"));
        System.out.println("  VmRSS:  " + readStatusField("VmRSS"));

        // Allocate 100MB (touched immediately because Java zeroes memory)
        byte[] data = new byte[100 * 1024 * 1024];
        // Prevent optimization from eliminating allocation
        data[0] = 1;

        System.out.println("\nAfter allocation (Java zeroes => touched):");
        System.out.println("  VmSize: " + readStatusField("VmSize"));
        System.out.println("  VmRSS:  " + readStatusField("VmRSS"));

        // Touch remaining pages explicitly
        for (int i = 0; i < data.length; i += 4096) {
            data[i] = (byte) (i % 256);
        }

        System.out.println("\nAfter explicit touch:");
        System.out.println("  VmSize: " + readStatusField("VmSize"));
        System.out.println("  VmRSS:  " + readStatusField("VmRSS"));
    }
}
