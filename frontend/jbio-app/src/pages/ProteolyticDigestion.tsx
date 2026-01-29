import React, { useEffect, useState } from "react";
import "./ProteolyticDigestion.css";
import { API_URL } from "../config";
import graph from "../assets/proteinGraph.png";
import emptyGraph from "../assets/EmptyProteinGraph.png";
import { Autocomplete, Button, FormControl, Grid, MenuItem, Select, TextField, Checkbox, Chip } from "@mui/material";
import { Link } from "react-router-dom";

const ProteolyticDigestion: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [proteins, setProteins] = useState([]);
  const [selectedProteins, setSelectedProteins] = useState<any[]>([]);
  const [currentSeq, setSequence] = useState("");
  const [aminoAcids, setAminoAcids] = useState([]);
  const [graphKey, setGraphKey] = useState(0);
  const [protease, setProtease] = useState("");
  // Safe Autocomplete initial values
  const fixedOptions: any[] = [];
  const [value, setValue] = React.useState<any[]>([]);

  // Ensure the Autocomplete value only contains options that are available
  React.useEffect(() => {
    if (!Array.isArray(value) || !Array.isArray(proteins)) return;
    const filtered = value.filter((v) => proteins.some((p: any) => p && p.name === v?.name));
    if (filtered.length !== value.length) setValue(filtered as any[]);
  }, [proteins]);

  const PROTEASES = new Map<string, string>();
  PROTEASES.set("PreScission", "Q");
  PROTEASES.set("Thrombin", "R");
  PROTEASES.set("Enterokinase", "K");
  PROTEASES.set("Chymotrypsin", "F");
  PROTEASES.set("trypsin", "K");
  PROTEASES.set("pepsin", "R");
  const updateCutProtein = async (
    sequence: string = currentSeq,
    protease_val: string = protease,
  ) => {
    setUploading(true);
    setMessage("Processing...");
    try {
      const payload = {
        sequence: sequence,
        aminoAcid: protease_val,
      };
      console.log(JSON.stringify(payload));
      const response = await fetch(
        `${API_URL}/proteolytic_digestion/seperateProtein`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to process sequence`);
      }

      const proteins = await response.json();
      console.log("Proteins from server:", proteins);
      setAminoAcids(proteins);

      setMessage("Processing successful!");
    } catch (error) {
      console.error("Error processing sequence:", error);
      setMessage("Error processing sequence.");
    } finally {
      setUploading(false);
      setGraphKey((prev) => prev + 1);

      setGraphKey((prev) => prev + 1); // <-- forces graph to reload
    }
  };
  const changeSelectedProtease = async (val: unknown) => {
    let temp = PROTEASES.get(val as string);
    if (typeof temp == "string") {
      setProtease(temp);
      await updateCutProtein(currentSeq, temp);
    } else {
      console.log(temp);
    }
  };
  const displaySequence = async (proteins: any[]) => {
    let protein = ""
    proteins.forEach((prot) =>{
      protein = protein + "\n "+prot["sequence"];
    });
    setSequence( protein);
    await updateCutProtein(protein, protease);
  };
  const isSelected = () => {
    return !(currentSeq == "");
  };

  const hasProteins = () => {
    return !(proteins.length == 0);
  };
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setMessage("Uploading...");

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          `${API_URL}/proteolytic_digestion/parse_fasta`,
          {
            method: "POST",
            body: formData,
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const proteins = await response.json();
        console.log("Uploaded proteins:", proteins);
        setProteins(proteins);
      }

      setMessage("Upload successful!");
    } catch (error) {
      console.error("Error uploading file:", error);
      setMessage("Error uploading file.");
    } finally {
      setUploading(false);
    }
  };


  return (
    <div className="proteolytic-page">
      <label
        className="twoDE-button icon"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          cursor: uploading ? "not-allowed" : "pointer",
          opacity: uploading ? 0.6 : 1,
        }}
      >
        Upload FASTA
        <input
          type="file"
          accept=".fasta,.fa,.faa,.FAA"
          multiple
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </label>

      {message && <p style={{ marginTop: "10px" }}>{message}</p>}
      <Grid container columns={3}>
        <Grid className="proteinlist" size={1}>
          <Grid container columns={1}>
            
            <Grid size={1}>
              <Autocomplete
              className="word"
                multiple
                id="proteins-multi"
                disableCloseOnSelect
                value={value}
                onChange={(_event, newValue) => {
                  setValue(newValue as any[]);
              
                    displaySequence(newValue);
                  
                }}
                options={proteins}
                getOptionLabel={(option: any) => option?.name ?? ""}
                isOptionEqualToValue={(o: any, v: any) => o?.name === v?.name}
                renderOption={(props, option: any, { selected }) => (
                  <li {...props}>
                    <Checkbox checked={selected} style={{ marginRight: 8 }} />
                    {option?.name}
                  </li>
                )}
                renderTags={(values, getTagProps) =>
                  values.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                      <Chip key={option?.name ?? index} label={option?.name} {...tagProps} />
                    );
                  })
                }
                style={{ width: 500 }}
                renderInput={(params) => (
                  <TextField {...params} label="Select Proteins" placeholder="Favorites" />
                )}
              />

            </Grid>



          </Grid>
        </Grid>
        <Grid size={1}>
          {hasProteins() ? (
            <img className="graph" src={`${graph}?v=${graphKey}`}></img>
          ) : (
            <img className="graph" src={`${emptyGraph}`}></img>
          )}
        </Grid>
        <Grid size={1}>
          <Grid container>
            <Grid size={12}>
              <div className="word">SELECTED PROTEIN</div>
              <div className="selectedProtein">
                {isSelected() ? currentSeq : "No protein selected"}
              </div>
            </Grid>
            <Grid container>
              <Grid size={4}>
                <div className="word">Select a protease</div>
                <FormControl className="word">
                  <Select
                    onChange={(e) => {
                      changeSelectedProtease(e.target.value);
                    }}
                  >
                    {Array.from(PROTEASES.entries()).map(([key, val]) => (
                      <MenuItem key={key} value={key}>
                        {key}: {val}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={4}>
                <div className="word">Amount of Amino Acids: {aminoAcids.length}</div>
              </Grid>
              <Grid size={4}>
                    <Link to="/peptide-retention" state={{aminoAcids: aminoAcids }}>Export to Oeptide Retention</Link>
              </Grid>
            </Grid>

            <Grid size={12}>
              <ol>
              {aminoAcids.map((value) => (
                <li><div className="selectedProtein">{value}</div></li>
              ))}
              </ol>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </div>
  );
};

export default ProteolyticDigestion;
