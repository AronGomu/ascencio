# Named XSD structures supplement the open-ended event vocabulary. Suffix ? means
# optional; ~ permits xsi:nil. Status-dependent requirements are checked in Rust.
COMMON = {
 'rate': 'value=xs:double~ numerator=xs:nonNegativeInteger denominator=xs:nonNegativeInteger',
 'quantiles': 'p50=xs:double~ p95=xs:double~ p99=xs:double~ maximum=xs:double~ sample_size=xs:nonNegativeInteger?',
 'deckCard': 'card_code=cardCode copies=xs:positiveInteger',
 'deckSections': 'main=deckSection extra=deckSection side=deckSection',
 'orderSections': 'main=orderSection extra=orderSection',
 'reasonRecord': 'code=xs:string explanation=xs:string factors=record?',
 'promptRecord': 'id=xs:string kind=xs:string player=actorType title=xs:string message=xs:string~ minimum=xs:nonNegativeInteger maximum=xs:nonNegativeInteger ordered=xs:boolean cancelable=xs:boolean constraints=record choices=choiceList',
 'choiceRecord': 'id=xs:string action=xs:string label=xs:string card_instance_id=xs:string? card_code=cardCode?~ card=record? allocation_maximum=xs:nonNegativeInteger~ value=record~ place=record~ selected=xs:boolean',
 'initialRecord': 'rules_profile=xs:string own_configuration=deckSections own_starting_order=orderSections own_opening_hand=record public_state=record',
 'neutralGame': 'game_id=xs:string number=xs:positiveInteger stage=stageType starter=actorType status=gameStatus winner=actorType~ draw=xs:boolean~ evidence_sha256=hashType~ bug_id=xs:string~ failure_category=xs:string? skip_reason=xs:string? duration_ms=xs:double? cleanup=record?',
 'perspectiveGame': 'game_id=xs:string stage=stageType starting_player=actorType status=gameStatus configuration_sha256=hashType? initial=initialRecord?~ timeline=timelineRecord? result=perspectiveResult? skip_reason=xs:string?',
 'perspectiveResult': 'outcome=perspectiveOutcome engine_reason=xs:string~ turns=xs:nonNegativeInteger~ duration_ms=xs:double engine_time_ms=xs:double~ bot_time_ms=xs:double~ evidence_sha256=hashType bug_id=xs:string~',
 'timelineEntry': 'sequence=xs:positiveInteger kind=entryKind actor=actorType~ turn=xs:nonNegativeInteger phase=xs:string decision_id=xs:string? prompt=promptRecord? selected_choice_ids=record? reason=reasonRecord? duration_ms=xs:double? event=xs:string? before_initial=xs:boolean? caused_by_decision_id=xs:string?~ changes=record? details=record?',
 'matchResult': 'a_wins=xs:nonNegativeInteger b_wins=xs:nonNegativeInteger draws=xs:nonNegativeInteger outcome=matchOutcome~',
 'summaryCounts': 'matches_requested=xs:nonNegativeInteger matches_completed=xs:nonNegativeInteger matches_incomplete=xs:nonNegativeInteger games_scheduled=xs:nonNegativeInteger games_completed=xs:nonNegativeInteger games_failed=xs:nonNegativeInteger games_skipped=xs:nonNegativeInteger completed_games_from_incomplete_matches=xs:nonNegativeInteger',
 'playerSummary': 'game_wins=xs:nonNegativeInteger game_losses=xs:nonNegativeInteger game_draws=xs:nonNegativeInteger game_win_rate=rate match_wins=xs:nonNegativeInteger match_losses=xs:nonNegativeInteger match_ties=xs:nonNegativeInteger match_win_rate=rate uncertainty=record match_uncertainty=record',
 'summaryResults':'a=playerSummary b=playerSummary match_score_distribution=record by_stage=record',
 'evalBatch':'matches=xs:positiveInteger execution=executionType',
 'evalLimits':'game_wall_time_ms=xs:positiveInteger decision_wall_time_ms=xs:positiveInteger sideboarding_wall_time_ms=xs:positiveInteger max_turns_per_game=xs:positiveInteger max_decisions_per_game=xs:positiveInteger',
 'evalBot':'module=xs:string config=bot-config',
 'evalBots':'a=evalBot b=evalBot',
 'evalDeck':'path=xs:string',
 'evalRules':'profile=profileType banlist=xs:string',
 'evalContent':'snapshot=xs:string',
 'evalOrders':'mode=orderMode fixture_path=xs:string~',
 'evalOutput':'directory=xs:string',
 'evalTarget':'warm_game_p95_ms=xs:double',
 'fixtureRecord':'matches=fixtureMatches',
 'fixtureMatch':'number=xs:positiveInteger games=fixtureGames',
 'fixtureGame':'number=fixtureGameNumber a=orderSections b=orderSections',
}
OVERRIDES = {
 'evaluation':dict(deck='evalDeck',bots='evalBots',batch='evalBatch',rules='evalRules',content='evalContent',starting_orders='evalOrders',limits='evalLimits',output='evalOutput'),
 'match':dict(games='neutralGames',result='matchResult',status='matchStatus'),
 'player-report':dict(games='perspectiveGames',perspective='actorType'),
 'summary':dict(counts='summaryCounts',results='summaryResults',status='runStatus'),
 'progress':dict(status='runStatus'),
 'starting-orders':dict(matches='fixtureMatches'),
}
ENUMS={'actorType':['a','b'],'stageType':['pre_side','post_side'],'gameStatus':['completed','failed','skipped'],'matchStatus':['completed','incomplete'],'runStatus':['running','completed','interrupted','failed'],'perspectiveOutcome':['win','loss','draw','failed','skipped'],'matchOutcome':['a','b','tie'],'entryKind':['decision','event'],'executionType':['sequential'],'profileType':['mr3','mr5'],'orderMode':['normal','fixture']}
def named_types():
 out=['<xs:simpleType name="fixtureGameNumber"><xs:restriction base="xs:positiveInteger"><xs:maxInclusive value="4"/></xs:restriction></xs:simpleType>']
 for name,values in ENUMS.items():out.append('<xs:simpleType name="'+name+'"><xs:restriction base="xs:string">'+''.join('<xs:enumeration value="'+v+'"/>' for v in values)+'</xs:restriction></xs:simpleType>')
 for name,pattern in [('hashType','[a-f0-9]{64}'),('cardCode','[0-9]+')]:out.append('<xs:simpleType name="'+name+'"><xs:restriction base="xs:string"><xs:pattern value="'+pattern+'"/></xs:restriction></xs:simpleType>')
 for name,fields in COMMON.items():
  out.append('<xs:complexType name="'+name+'"><xs:all>')
  for field in fields.split():
   key,ty=field.split('=');optional='?' in ty;nil='~' in ty;ty=ty.replace('?','').replace('~','')
   out.append(f'<xs:element name="{key}" type="{ty}" minOccurs="{0 if optional else 1}" nillable="{str(nil).lower()}"/>')
  out.append('</xs:all></xs:complexType>')
 for name,child,ty,minimum,maximum in [('deckSection','card','deckCard',0,'unbounded'),('orderSection','card','cardCode',0,'unbounded'),('choiceList','choice','choiceRecord',0,'unbounded'),('neutralGames','game','neutralGame',4,4),('perspectiveGames','game','perspectiveGame',4,4),('timelineRecord','entry','timelineEntry',0,'unbounded'),('fixtureMatches','match','fixtureMatch',1,'unbounded'),('fixtureGames','game','fixtureGame',4,4)]:
  out.append(f'<xs:complexType name="{name}"><xs:sequence><xs:element name="{child}" type="{ty}" minOccurs="{minimum}" maxOccurs="{maximum}"/></xs:sequence></xs:complexType>')
 return out
