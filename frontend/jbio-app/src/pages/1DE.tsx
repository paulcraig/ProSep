import OneDESim from '../components/1DESimulation';

function OneDE() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "2rem",
        padding: "0 2rem",
      }}
    >
      <div
        style={{
          flex: "1 1 30%",
        }}
      >
        <OneDESim />
      </div>

      <div
        style={{
          flex: "0 1 30%",
          minWidth: "450px",
          maxWidth: "600px",
          border: "4px solid var(--accent)",
          background: "var(--sub-background)",
          borderRadius: "8px",
          padding: "1.5rem",
          boxSizing: "border-box",
          marginBottom: "2rem",
          marginRight: "2rem",
          whiteSpace: "nowrap",
          overflowX: "auto",
        }}
      >
        <h2 className="section-header" id="1de-page-instructions">
          Instructions
        </h2>
        <ol
          style={{
            paddingLeft: "1.25rem",
            lineHeight: 1.5,
            marginBottom: "1rem",
          }}
        >
          <li>Add or remove wells as needed.</li>
          <li>Select wells to upload FASTA files.</li>
          <ul style={{ lineHeight: 1.5, marginBlock: "0.5rem" }}>
            <li>Click and drag to swap well contents.</li>
            <li>Hover over wells to see uploaded files.</li>
            <li>Remove uploaded files by double-clicking</li>
          </ul>
          <li>Select or deselect protein standards.</li>
          <li>Choose the voltage setting (50 / 100 / 150 / 200 V).</li>
          <li>Choose the acrylamide concentration (7.5 / 10 / 12 / 15%).</li>
          <ul style={{ lineHeight: 1.5, marginBlock: "0.5rem" }}>
            <li>
              Click <strong>Start</strong> to begin the run.
            </li>
            <li>
              Click <strong>Stop</strong> to end the run manually.
            </li>
            <li>
              Click <strong>Clear</strong> to clear all uploaded files and
              reset.
            </li>
            <li>
              Click <strong>Reset</strong> to return bands to their starting
              positions.
            </li>
            <li>
              Click <strong>Upload</strong> to upload multiple FASTA files at
              once.
            </li>
          </ul>
        </ol>

        <h2 className="section-header" id="1de-page-notes">
          Notes
        </h2>
        <ul
          style={{ paddingLeft: "1.25rem", lineHeight: 1.5, marginBottom: 0 }}
        >
          <li>The exact number of wells is flexible.</li>
          <li>Protein bands stop at their relative migration distances.</li>
        </ul>
      </div>
    </div>
  );
}

export default OneDE;
