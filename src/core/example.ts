export const EXAMPLE = `@prefix : <https://example.org/academy#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<https://example.org/academy> a owl:Ontology ;
  rdfs:label "The academy" ;
  rdfs:comment "A small ontology for exploring people, research, and the connections between them." .

:Person a owl:Class ; rdfs:label "Person" ;
  rdfs:comment "A person in the academic community." .
:Researcher a owl:Class ; rdfs:label "Researcher" ;
  rdfs:subClassOf :Person ;
  rdfs:comment "A person who carries out research. Professors inherit this class." .
:Professor a owl:Class ; rdfs:label "Professor" ;
  rdfs:subClassOf :Researcher ;
  rdfs:comment "A researcher who teaches and supervises students." .
:Student a owl:Class ; rdfs:label "Student" ; rdfs:subClassOf :Person .
:Organization a owl:Class ; rdfs:label "Organization" .
:University a owl:Class ; rdfs:label "University" ; rdfs:subClassOf :Organization .
:Publication a owl:Class ; rdfs:label "Publication" .
:Article a owl:Class ; rdfs:label "Article" ; rdfs:subClassOf :Publication .

:worksAt a owl:ObjectProperty ; rdfs:label "works at" ; rdfs:domain :Person ; rdfs:range :Organization .
:supervises a owl:ObjectProperty ; rdfs:label "supervises" ; rdfs:domain :Professor ; rdfs:range :Student .
:authored a owl:ObjectProperty ; rdfs:label "authored" ; rdfs:domain :Researcher ; rdfs:range :Publication .
:age a owl:DatatypeProperty ; rdfs:label "age" ; rdfs:domain :Person ; rdfs:range xsd:integer .
:note a owl:AnnotationProperty ; rdfs:label "note" .

:Alice a owl:NamedIndividual, :Professor ; rdfs:label "Alice" ;
  :worksAt :Kyoto ; :supervises :Theo ; :authored :Paper ; :age 42 .
:Theo a owl:NamedIndividual, :Student ; rdfs:label "Theo" .
:Kyoto a owl:NamedIndividual, :University ; rdfs:label "Kyoto University" .
:Paper a owl:NamedIndividual, :Article ; rdfs:label "On connected ideas" .
`;
export const DEFAULT_SHAPES = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix : <https://example.org/academy#> .

:PersonShape a sh:NodeShape ;
  sh:targetClass :Person ;
  sh:property [
    sh:path rdfs:label ;
    sh:minCount 1 ;
    sh:message "Give each person a human-readable label." ;
  ] .
`;
export const DEFAULT_QUERY = `# Query the ontology on your device.
SELECT ?entity ?label
WHERE {
  ?entity a owl:Class .
  OPTIONAL { ?entity rdfs:label ?label }
}
ORDER BY ?label`;
