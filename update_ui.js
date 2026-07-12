const fs = require('fs');
let file = 'frontend/src/app/admin/matches/live/page.js';
let content = fs.readFileSync(file, 'utf8');

const searchSetup = \              <h3 style={{ marginTop: '20px', color: 'var(--color-gold)' }}>出席者選択 (\ + \{attendingIds.length}\ + \人)</h3>
              <div className={styles.startersGrid}>
                {players.map(p => {
                  const isAttending = attendingIds.includes(p.user_id);
                  return (
                    <div key={p.user_id} className={\\ + \\ \\ + \\} onClick={() => toggleAttendee(p.user_id)}>
                      <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                      <div className={styles.playerName}>{p.name}</div>
                    </div>
                  );
                })}
              </div>

              {attendingIds.length > 0 && (
                <>
                  <h3 style={{ marginTop: '30px', color: 'var(--color-gold)' }}>スタメン配置</h3>
                  <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '10px' }}>ピッチ上の（＋）を押してからベンチメンバーをタップ</p>
                  <div className={styles.pitchContainer}>
                    <div className={styles.pitchCenterLine} />
                    <div className={styles.pitchCenterCircle} />
                    <div className={styles.pitchPenaltyAreaTop} />
                    <div className={styles.pitchPenaltyAreaBottom} />
                    {positions.map(pos => renderPitchSlot(pos, true))}
                  </div>

                  <h3 style={{ marginTop: '20px', color: '#ccc' }}>ベンチメンバー</h3>
                  <div className={styles.startersGrid}>
                    {benchIds.map(id => {
                      const p = players.find(x => x.user_id === id);
                      if (!p) return null;
                      return (
                        <div key={p.user_id} className={styles.playerSelectCard} onClick={() => handlePlayerTap(p.user_id, 'bench')}>
                          <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                          <div className={styles.playerName}>{p.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}\;

const replaceSetup = \              {matchMode === 'external' ? (
                <>
                  <h3 style={{ marginTop: '20px', color: 'var(--color-gold)' }}>出席者選択 ({attendingIds.length}人)</h3>
                  <div className={styles.startersGrid}>
                    {players.map(p => {
                      const isAttending = attendingIds.includes(p.user_id);
                      return (
                        <div key={p.user_id} className={\\ \\} onClick={() => toggleAttendee(p.user_id)}>
                          <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                          <div className={styles.playerName}>{p.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <h3 style={{ marginTop: '20px', color: 'var(--color-gold)' }}>チーム分け（参加者選択）</h3>
                  <div className={styles.teamAssignGrid}>
                    {players.map(p => {
                      const team = playerTeams[p.user_id];
                      return (
                        <div key={p.user_id} className={styles.teamAssignCard}>
                          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                            <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                            <div className={styles.playerName}>{p.name}</div>
                          </div>
                          <div className={styles.teamBtns}>
                            <button 
                              className={\\ \\}
                              onClick={() => assignTeam(p.user_id, 'red')}
                            >RED</button>
                            <button 
                              className={\\ \\}
                              onClick={() => assignTeam(p.user_id, 'blue')}
                            >BLUE</button>
                            <button 
                              className={\\ \\}
                              onClick={() => assignTeam(p.user_id, null)}
                            >休</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {attendingIds.length > 0 && (
                <>
                  <h3 style={{ marginTop: '30px', color: 'var(--color-gold)' }}>スタメン配置</h3>
                  <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '10px' }}>
                    {matchMode === 'external' ? 'ピッチ上の（＋）を押してからベンチメンバーをタップ' : 'ポジションを押してからベンチメンバーをタップ'}
                  </p>
                  
                  {matchMode === 'external' ? (
                    <div className={styles.pitchContainer}>
                      <div className={styles.pitchCenterLine} />
                      <div className={styles.pitchCenterCircle} />
                      <div className={styles.pitchPenaltyAreaTop} />
                      <div className={styles.pitchPenaltyAreaBottom} />
                      {positions.map(pos => renderPitchSlot(pos, true))}
                    </div>
                  ) : (
                    <div className={styles.intraSetupLayout}>
                      <div className={styles.teamSetupCol}>
                         <h4 style={{color: '#ff6b6b'}}>{matchInfo.team1_name || 'RED'} スタメン</h4>
                         <div className={styles.listSlotContainer}>
                           {['red_Pivo', 'red_AlaL', 'red_AlaR', 'red_Fixo', 'red_GK'].map(pos => renderListSlot(pos))}
                         </div>
                      </div>
                      <div className={styles.teamSetupCol}>
                         <h4 style={{color: '#4dabf7'}}>{matchInfo.team2_name || 'BLUE'} スタメン</h4>
                         <div className={styles.listSlotContainer}>
                           {['blue_Pivo', 'blue_AlaL', 'blue_AlaR', 'blue_Fixo', 'blue_GK'].map(pos => renderListSlot(pos))}
                         </div>
                      </div>
                    </div>
                  )}

                  <h3 style={{ marginTop: '20px', color: '#ccc' }}>ベンチメンバー</h3>
                  {matchMode === 'external' ? (
                    <div className={styles.startersGrid}>
                      {benchIds.map(id => {
                        const p = players.find(x => x.user_id === id);
                        if (!p) return null;
                        return (
                          <div key={p.user_id} className={styles.playerSelectCard} onClick={() => handlePlayerTap(p.user_id, 'bench')}>
                            <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                            <div className={styles.playerName}>{p.name}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.intraBenchLayout}>
                      <div className={styles.teamBenchCol}>
                        <h4 style={{color: '#ff6b6b'}}>{matchInfo.team1_name || 'RED'} ベンチ</h4>
                        <div className={styles.startersGrid}>
                          {benchIds.filter(id => playerTeams[id] === 'red').map(id => {
                            const p = players.find(x => x.user_id === id);
                            if (!p) return null;
                            return (
                              <div key={p.user_id} className={styles.playerSelectCard} onClick={() => handlePlayerTap(p.user_id, 'bench')}>
                                <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                                <div className={styles.playerName}>{p.name}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className={styles.teamBenchCol}>
                        <h4 style={{color: '#4dabf7'}}>{matchInfo.team2_name || 'BLUE'} ベンチ</h4>
                        <div className={styles.startersGrid}>
                          {benchIds.filter(id => playerTeams[id] === 'blue').map(id => {
                            const p = players.find(x => x.user_id === id);
                            if (!p) return null;
                            return (
                              <div key={p.user_id} className={styles.playerSelectCard} onClick={() => handlePlayerTap(p.user_id, 'bench')}>
                                <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.avatarSmall} />
                                <div className={styles.playerName}>{p.name}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}\;

const searchPlayingBench = \              <div className={styles.benchSection} data-drop-target="bench">
                <h2 className={styles.sectionTitle} style={{fontSize:'1rem'}}>ベンチ</h2>
                <div className={styles.playerList}>
                  {benchIds.map(id => {
                    const p = players.find(x => x.user_id === id);
                    if (!p) return null;
                    const isSelected = swapSourceId === id;
                    return (
                      <div 
                        key={id} 
                        className={\\ + \\ \\ + \\}
                        onClick={() => handlePlayerTap(id, 'bench')}
                      >
                        <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.playerRowAvatar} />
                        <div className={styles.playerRowName}>{p.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>\;

const replacePlayingBench = \              {matchMode === 'external' ? (
                <div className={styles.benchSection} data-drop-target="bench">
                  <h2 className={styles.sectionTitle} style={{fontSize:'1rem'}}>ベンチ</h2>
                  <div className={styles.playerList}>
                    {benchIds.map(id => {
                      const p = players.find(x => x.user_id === id);
                      if (!p) return null;
                      const isSelected = swapSourceId === id;
                      return (
                        <div 
                          key={id} 
                          className={\\ \\}
                          onClick={() => handlePlayerTap(id, 'bench')}
                        >
                          <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.playerRowAvatar} />
                          <div className={styles.playerRowName}>{p.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className={styles.intraBenchLayout} data-drop-target="bench">
                  <div className={styles.teamBenchCol}>
                    <h4 style={{color: '#ff6b6b'}}>{matchInfo.team1_name || 'RED'} ベンチ</h4>
                    <div className={styles.playerList}>
                      {benchIds.filter(id => playerTeams[id] === 'red').map(id => {
                        const p = players.find(x => x.user_id === id);
                        if (!p) return null;
                        const isSelected = swapSourceId === id;
                        return (
                          <div 
                            key={id} 
                            className={\\ \\}
                            onClick={() => handlePlayerTap(id, 'bench')}
                          >
                            <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.playerRowAvatar} />
                            <div className={styles.playerRowName}>{p.name}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className={styles.teamBenchCol}>
                    <h4 style={{color: '#4dabf7'}}>{matchInfo.team2_name || 'BLUE'} ベンチ</h4>
                    <div className={styles.playerList}>
                      {benchIds.filter(id => playerTeams[id] === 'blue').map(id => {
                        const p = players.find(x => x.user_id === id);
                        if (!p) return null;
                        const isSelected = swapSourceId === id;
                        return (
                          <div 
                            key={id} 
                            className={\\ \\}
                            onClick={() => handlePlayerTap(id, 'bench')}
                          >
                            <img src={p.photo_url ? getImageUrl(p.photo_url) : '/default-avatar.png'} className={styles.playerRowAvatar} />
                            <div className={styles.playerRowName}>{p.name}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}\;

content = content.replace(searchSetup, replaceSetup);
content = content.replace(searchPlayingBench, replacePlayingBench);
fs.writeFileSync(file, content);
console.log('Setup replaced: ' + (content.includes('teamAssignGrid') ? 'YES' : 'NO'));
console.log('Playing Bench replaced: ' + (content.includes('intraBenchLayout} data-drop-target') ? 'YES' : 'NO'));
