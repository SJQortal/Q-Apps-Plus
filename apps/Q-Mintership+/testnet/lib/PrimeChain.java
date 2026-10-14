// Q-Mintership+ private testnet (dev-only).
//
// Creates a fresh testnet's database and its genesis block offline, with
// Core's own classes, before the node's first start:
//
//   java -cp qortal.jar PrimeChain.java        (in the testnet home)
//
// Why: Core 6.1.9 can't start a brand-new chain. With no QDN resources yet,
// its "latest signatures" upgrade runs an empty JDBC batch and fails
// ("statement is not in batch mode"), so the node stops before its API
// starts. On a fresh chain there is nothing to upgrade, so this marks that
// step done, then closes the database cleanly.
import java.security.Security;
import java.sql.Statement;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.jsse.provider.BouncyCastleJsseProvider;
import org.qortal.block.GenesisBlock;
import org.qortal.repository.Repository;
import org.qortal.repository.RepositoryManager;
import org.qortal.repository.hsqldb.HSQLDBRepositoryFactory;
import org.qortal.settings.Settings;

public class PrimeChain {
    public static void main(String[] args) throws Exception {
        // As Controller.main does first: Core hashes addresses with Bouncy Castle's RIPEMD160.
        Security.insertProviderAt(new BouncyCastleProvider(), 0);
        Security.insertProviderAt(new BouncyCastleJsseProvider(), 1);
        Settings.fileInstance("settings.json");
        String url = "jdbc:hsqldb:file:" + Settings.getInstance().getRepositoryPath()
                + "/blockchain;create=true;hsqldb.full_log_replay=true";
        RepositoryManager.setRepositoryFactory(new HSQLDBRepositoryFactory(url));
        try (Repository repository = RepositoryManager.getRepository()) {
            if (repository.getBlockRepository().getBlockchainHeight() == 0) {
                GenesisBlock.getInstance(repository).process();
                repository.saveChanges();
                System.out.println("Genesis block created.");
            }
            try (Statement s = repository.getConnection().createStatement()) {
                s.executeUpdate("UPDATE DatabaseInfo SET latest_signature_populated = 1");
            }
            repository.saveChanges();
            System.out.println("Height " + repository.getBlockRepository().getBlockchainHeight() + "; QDN signature step marked done.");
        }
        RepositoryManager.closeRepositoryFactory();
        System.exit(0);
    }
}
