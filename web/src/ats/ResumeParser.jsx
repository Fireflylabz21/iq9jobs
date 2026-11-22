import { useState, useCallback, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import mammoth from "mammoth";

if (typeof window !== "undefined") {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch (e) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.js";
  }
}

const DEFAULT_SKILL_DICTIONARY = [
  { name: "JavaScript", aliases: ["js", "javascript", "es6", "es2015+"] },
  { name: "TypeScript", aliases: ["ts", "typescript"] },
  { name: "React", aliases: ["reactjs", "react.js", "react native"] },
  { name: "Next.js", aliases: ["nextjs", "next.js"] },
  { name: "Node.js", aliases: ["node", "nodejs"] },
  { name: "Python", aliases: ["py", "python3"] },
  { name: "Java", aliases: [] },
  { name: "Go", aliases: ["golang"] },
  { name: "Rust", aliases: [] },
  { name: "SQL", aliases: ["postgresql", "mysql", "mongodb", "redis"] },
  { name: "AWS", aliases: ["amazon web services", "ec2", "s3", "lambda"] },
  { name: "Docker", aliases: [] },
  { name: "Kubernetes", aliases: ["k8s"] },
  { name: "Git", aliases: ["github", "gitlab"] },
  { name: "Tailwind CSS", aliases: ["tailwind", "tailwindcss"] },
  { name: "HTML", aliases: ["html5"] },
  { name: "CSS", aliases: ["css3", "scss", "sass"] },
];

function extractContact(text) {
  const contact = {};
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) contact.email = emailMatch[0];
  const phoneMatch = text.match(/(\+?\d{1,3}[\s-]?)?(\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{4}/);
  if (phoneMatch) contact.phone = phoneMatch[0];
  const linkedinMatch = text.match(/linkedin\.com\/in\/[a-zA-Z0-9-]+/);
  if (linkedinMatch) contact.linkedin = linkedinMatch[0];
  return contact;
}

function extractSkills(text, dictionary = DEFAULT_SKILL_DICTIONARY) {
  const lower = text.toLowerCase();
  const found = new Set();
  dictionary.forEach((entry) => {
    const patterns = [entry.name.toLowerCase(), ...entry.aliases.map((a) => a.toLowerCase())];
    if (patterns.some((p) => lower.includes(p))) {
      found.add(entry.name);
    }
  });
  return Array.from(found);
}

function extractSections(text) {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const experience = [];
  const education = [];
  let current = null;
  lines.forEach((line) => {
    const l = line.toLowerCase();
    if (/(work|professional|employment) experience/.test(l)) { current = "experience"; return; }
    if (/education|academic|degree/.test(l)) { current = "education"; return; }
    if (/skills|technical|tools|certifications/.test(l)) { current = null; return; }
    if (current === "experience" && line.length > 5) experience.push(line);
    if (current === "education" && line.length > 5) education.push(line);
  });
  return { experience, education };
}

export function parseResumeText(rawText, dictionary = DEFAULT_SKILL_DICTIONARY) {
  const contact = extractContact(rawText);
  const skills = extractSkills(rawText, dictionary);
  const { experience, education } = extractSections(rawText);
  return { rawText, contact, skills, experience, education };
}

export function ResumeParser({ onParsed, jobSkills = [], dictionary = DEFAULT_SKILL_DICTIONARY, className }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [editableSkills, setEditableSkills] = useState([]);
  const [editableContact, setEditableContact] = useState({});

  const parseFile = useCallback(async (f) => {
    setParsing(true);
    setError(null);
    try {
      let rawText = "";
      if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
        const arrayBuffer = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((item) => item.str).join(" "));
        }
        rawText = pages.join("\n");
      } else if (
        f.type.includes("word") ||
        f.name.toLowerCase().endsWith(".docx") ||
        f.name.toLowerCase().endsWith(".doc")
      ) {
        const arrayBuffer = await f.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        rawText = result.value;
      } else {
        throw new Error("Unsupported file type. Please upload a PDF or DOCX.");
      }

      const parsedResume = parseResumeText(rawText, dictionary);
      setParsed(parsedResume);
      setEditableSkills([...parsedResume.skills]);
      setEditableContact({ ...parsedResume.contact });
      onParsed(parsedResume);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse resume.";
      if (msg.includes("offline") || msg.includes("Failed to fetch")) {
        setError("Resume parser failed to load. Please check your internet connection and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setParsing(false);
    }
  }, [dictionary, onParsed]);

  const matchPercentage = useCallback(() => {
    if (!parsed || jobSkills.length === 0) return 0;
    const jobSet = new Set(jobSkills.map((s) => s.toLowerCase()));
    const parsedSet = new Set(parsed.skills.map((s) => s.toLowerCase()));
    const matched = [...jobSet].filter((s) => parsedSet.has(s)).length;
    return Math.round((matched / jobSet.size) * 100);
  }, [parsed, jobSkills]);

  useEffect(() => {
    if (file) {
      parseFile(file);
    }
  }, [file, parseFile]);

  const handleSkillAdd = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val && !editableSkills.includes(val)) {
        setEditableSkills([...editableSkills, val]);
        e.target.value = "";
      }
    }
  };

  const handleSkillRemove = (skill) => {
    setEditableSkills(editableSkills.filter((s) => s !== skill));
  };

  return (
    <section className={`resume-parser ${className || ""}`}>
      <div className="resume-parser-card">
        <h2 className="resume-parser-title">Resume Upload & Auto-Parse</h2>
        <p className="resume-parser-hint">
          Upload a PDF or DOCX resume. Text is extracted entirely in your browser —
          no file is sent to a server for parsing.
        </p>

        <div className="resume-parser-upload">
          <input
            type="file"
            accept=".pdf,.docx,.doc"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (!f) setParsed(null);
            }}
            disabled={parsing}
            className="file-input"
          />
          {file && (
            <span className="file-name">{file.name} ({Math.round(file.size / 1024)} KB)</span>
          )}
          {parsing && <span className="parsing">Parsing resume…</span>}
          {error && <span className="parse-error">{error}</span>}
        </div>

        {parsed && (
          <>
            <div className="match-score-badge">
              {jobSkills.length > 0 ? `Skill match: ${matchPercentage()}%` : "Parsed successfully"}
            </div>

            <div className="resume-parser-grid">
              <div className="parser-field">
                <label>Contact Details</label>
                <div className="contact-grid">
                  <div>
                    <label>Email</label>
                    <input
                      value={editableContact.email ?? ""}
                      onChange={(e) => setEditableContact({ ...editableContact, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label>Phone</label>
                    <input
                      value={editableContact.phone ?? ""}
                      onChange={(e) => setEditableContact({ ...editableContact, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label>Location</label>
                    <input
                      value={editableContact.location ?? ""}
                      onChange={(e) => setEditableContact({ ...editableContact, location: e.target.value })}
                    />
                  </div>
                  <div>
                    <label>LinkedIn</label>
                    <input
                      value={editableContact.linkedin ?? ""}
                      onChange={(e) => setEditableContact({ ...editableContact, linkedin: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="parser-field">
                <label>Skills (editable)</label>
                <div className="skill-chips">
                  {editableSkills.map((skill) => (
                    <span key={skill} className="skill-chip">
                      {skill}
                      <button type="button" onClick={() => handleSkillRemove(skill)}>&times;</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="Add a skill…"
                    onKeyDown={handleSkillAdd}
                    className="skill-input"
                  />
                </div>
                {parsed.experience.length > 0 && (
                  <div className="parser-section">
                    <label>Experience</label>
                    <ul className="parser-list">
                      {parsed.experience.slice(0, 5).map((exp, i) => (
                        <li key={i}>{exp}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {parsed.education.length > 0 && (
                  <div className="parser-section">
                    <label>Education</label>
                    <ul className="parser-list">
                      {parsed.education.slice(0, 5).map((edu, i) => (
                        <li key={i}>{edu}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="parser-field">
                <label>Extracted Text (preview)</label>
                <textarea
                  value={parsed.rawText}
                  readOnly
                  className="raw-text-preview"
                  rows={6}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
