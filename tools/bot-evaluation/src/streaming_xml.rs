//! Append failure occurrences without loading prior occurrences into memory.
use crate::xml::{self, Result};
use quick_xml::{
    events::{BytesText, Event},
    Reader, Writer,
};
use serde_json::Value;
use std::{
    fs,
    io::{BufReader, BufWriter, Write},
    path::Path,
};
pub fn validate(path: &Path, root: &str) -> Result<()> {
    let mut reader = Reader::from_reader(BufReader::new(fs::File::open(path)?));
    let mut buffer = Vec::new();
    loop {
        match reader.read_event_into(&mut buffer)? {
            Event::DocType(_) => return Err("DTD forbidden".into()),
            Event::Eof => break,
            _ => (),
        };
        buffer.clear();
    }
    let output = std::process::Command::new("xmllint")
        .args(["--nonet", "--stream", "--noout", "--schema"])
        .arg(format!("schemas/bot-evaluation/v1/{root}.xsd"))
        .arg(path)
        .output()?;
    if !output.status.success() {
        return Err(format!(
            "Streaming schema validation: {}",
            String::from_utf8_lossy(&output.stderr)
        )
        .into());
    }
    Ok(())
}
pub fn count(path: &Path, element: &str) -> Result<u64> {
    let mut reader = Reader::from_reader(BufReader::new(fs::File::open(path)?));
    let mut buffer = Vec::new();
    let mut count = 0;
    loop {
        match reader.read_event_into(&mut buffer)? {
            Event::Start(e) | Event::Empty(e) if e.name().as_ref() == element.as_bytes() => {
                count += 1
            }
            Event::DocType(_) => return Err("DTD forbidden".into()),
            Event::Eof => break,
            _ => (),
        };
        buffer.clear();
    }
    Ok(count)
}
pub fn append(
    path: &Path,
    container: &str,
    child: &str,
    value: &Value,
    new_count: Option<u64>,
) -> Result<()> {
    let _timer = xml::WriteTimer::start();
    let bytes = xml::fragment(child, value)?;
    let tmp = path.with_extension("xml.tmp");
    let mut reader = Reader::from_reader(BufReader::new(fs::File::open(path)?));
    let mut writer = Writer::new(BufWriter::new(fs::File::create(&tmp)?));
    let mut buffer = Vec::new();
    let mut count_text = false;
    let mut inserted = false;
    loop {
        let event = reader.read_event_into(&mut buffer)?;
        match &event {
            Event::DocType(_) => return Err("DTD forbidden".into()),
            Event::Start(e) if e.name().as_ref() == b"occurrence_count" => count_text = true,
            Event::Text(_) if count_text && new_count.is_some() => {
                writer.write_event(Event::Text(BytesText::new(&new_count.unwrap().to_string())))?;
                buffer.clear();
                continue;
            }
            Event::End(e) if e.name().as_ref() == container.as_bytes() => {
                writer.get_mut().write_all(&bytes)?;
                inserted = true;
            }
            Event::End(_) => count_text = false,
            Event::Eof => break,
            _ => (),
        }
        writer.write_event(event)?;
        buffer.clear();
    }
    if !inserted {
        return Err("Missing append collection".into());
    }
    let mut file = writer.into_inner();
    file.flush()?;
    file.get_ref().sync_all()?;
    fs::rename(tmp, path)?;
    #[cfg(unix)]
    fs::File::open(path.parent().unwrap())?.sync_all()?;
    Ok(())
}

pub fn scalar(path: &Path, name: &str) -> Result<String> {
    let mut reader = Reader::from_reader(BufReader::new(fs::File::open(path)?));
    let mut buf = Vec::new();
    let mut active = false;
    loop {
        match reader.read_event_into(&mut buf)? {
            Event::Start(e) => active = e.name().as_ref() == name.as_bytes(),
            Event::Text(e) if active => return Ok(e.decode()?.into_owned()),
            Event::DocType(_) => return Err("DTD forbidden".into()),
            Event::Eof => return Err("Missing metadata".into()),
            _ => (),
        };
        buf.clear();
    }
}
