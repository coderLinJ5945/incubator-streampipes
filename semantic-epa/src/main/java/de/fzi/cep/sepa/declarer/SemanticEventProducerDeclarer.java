package de.fzi.cep.sepa.desc.declarer;

import java.util.List;

import de.fzi.cep.sepa.model.impl.graph.SepDescription;

public interface SemanticEventProducerDeclarer extends Declarer<SepDescription> {
	public List<EventStreamDeclarer> getEventStreams();
}